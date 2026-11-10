# Architecture

## Tier split: Contracts vs. Impl

`RateLimiting.Contracts` references only `BieberWorks.SDK.SharedKernel` (Tier 1). It defines `IRateLimiter`, the DTOs, `IRateLimitPolicyProvider`, and `IRateLimitPolicyRegistry` — no reference to SDK-Settings. This lets Tier-2 modules (e.g. Auth) reference `RateLimiting.Contracts` without a tier cycle.

The Settings integration lives exclusively in the Impl package `BieberWorks.SDK.RateLimiting`, via a `PackageReference` to `BieberWorks.SDK.Settings.Contracts`. `RateLimitingModule.RegisterServices` registers the provider through a factory, so the choice is made at resolution time and the registration order of SDK-Settings vs. RateLimiting does not matter:

```csharp
services.TryAddSingleton<IRateLimitPolicyProvider>(sp =>
    sp.GetService<ISettingsService>() is { } settings
        ? new SettingsBackedRateLimitPolicyProvider(settings, registry, cache)
        : new DefaultRateLimitPolicyProvider(registry));
```

A provider registered by the host beforehand is kept (`TryAdd`).

This means a host that never adds SDK-Settings gets a fully functional, code-default-only rate limiter — no crash, no silent no-op.

## Policy resolution flow

1. A module (e.g. Auth) registers its default policy once at module start:
   `IRateLimitPolicyRegistry.Register(new RateLimitPolicy(WellKnownRateLimitPolicies.Login, 5, TimeSpan.FromMinutes(15)))`.
2. At request time, `IRateLimiter.TryAcquireAsync(policyName, partitionKey)` resolves the effective policy via `IRateLimitPolicyProvider.GetPolicy(policyName)`.
3. `DefaultRateLimitPolicyProvider` always returns the code-default registry entry.
4. `SettingsBackedRateLimitPolicyProvider` reads `ratelimit:<policy>:<property>` overrides from `ISettingsService`, short-TTL cached (30s) via `IMemoryCache`, falling back to the code default for any property that has no override.

## Backing store seam

`IRateLimitStore` (internal, not part of the public contract) is the swap point for a future distributed store:

```csharp
internal interface IRateLimitStore
{
    Task<RateLimitCounterState> IncrementAsync(RateLimitStoreKey key, TimeSpan window, CancellationToken ct);
    Task<RateLimitCounterState?> PeekAsync(RateLimitStoreKey key, CancellationToken ct);
    Task SetLockoutAsync(RateLimitStoreKey key, TimeSpan duration, CancellationToken ct);
    Task ResetAsync(RateLimitStoreKey key, CancellationToken ct);
}
```

Only `InMemoryRateLimitStore` (a `ConcurrentDictionary`-backed, fixed-window implementation) ships in this release. It is process-local — not shared across horizontally scaled instances. A future `BieberWorks.SDK.RateLimiting.Redis` package would supply an alternative `IRateLimitStore` without touching `IRateLimiter` callers.

## Gating pattern: acquire first, reset on success

`PeekAsync` is advisory (display only). Gates take the slot with `TryAcquireAsync` *before* the protected check and call `ResetAsync` on success:

1. `TryAcquireAsync` → rejected: return 429 with `RetryAfter`.
2. Run the check (password, OTP, key).
3. Success → `ResetAsync`. Failure → nothing else to do, the attempt is already counted.

A peek-then-acquire gate has two defects: concurrent requests all pass the peek before any of them counts (a burst multiplies the budget), and a `LockoutDuration` never starts, because the lockout begins with the acquire that *exceeds* the limit and a peek gate stops callers one acquire earlier. Checks that fail before the protected step (unknown user, disabled feature) still consume a slot; that is intentional (fail-closed).

## Algorithms

Only fixed windows are evaluated. `RateLimitAlgorithm.SlidingWindow` is accepted (contract and Settings key), but evaluated as a fixed window in this release; the limiter logs a warning once per policy. Around a window boundary up to twice `PermitLimit` can pass. Counters are process-local: with N instances, each instance enforces the limit separately.

## Window, lockout and peek semantics

- A window is fixed: the first acquire opens it, and it resets entirely once `WindowResetAt` has passed.
- A lockout starts with the acquire that *exceeds* `PermitLimit`. While it is active, every acquire and peek is rejected with `RetryAfter` = remaining lockout time. A lockout that outlives its window keeps the partition blocked until the lockout ends.
- Once both the window and the lockout have expired, the old counter no longer counts. Peek reports the full quota again, and the next acquire opens a fresh window without carrying over the expired lockout.
- When the budget is used up but no lockout is active, peek returns `Allowed = false` together with `RetryAfter` = time until the window resets, so callers can send a correct `Retry-After` header.
- All timestamps come from `TimeProvider` (registered as `TimeProvider.System` via `TryAdd`), so a host or test can supply its own clock.

## Store bounds and eviction

The in-memory store is bounded, so a flood of distinct partition keys (e.g. rotating IPs) cannot exhaust memory:

- **Sweep:** expired counters (window over, no active lockout) are removed at most once per `SweepInterval`. The sweep is triggered by store access, not by a timer.
- **Caps:** `MaxEntriesPerPolicy` limits each policy, `MaxEntries` limits the whole store. A flood on one policy therefore cannot evict counters of another policy.
- **Eviction order:** when a cap is exceeded, the store trims to 90 % of the cap, removing expired entries first, then live counters with the lowest count (earliest window end first). Partitions with an active lockout are evicted last. A flood of single-hit keys thus cannot push out a counter that already recorded several attempts.
- **Fail-closed:** a new key is always counted; eviction runs afterwards, single-flight on a snapshot. Under heavy concurrency the store may briefly exceed a cap by about the number of concurrent writers. Each trim logs a warning.

Entry counts are tracked with `Interlocked` counters, so the hot path never takes all dictionary locks.

## No DbContext

Rate limit state is intentionally volatile (counters with a TTL). Persisting it would contradict the purpose and add DB load to a hot path. Policy *configuration* (the override values) is what SDK-Settings persists — not the counters themselves.

## ASP.NET integration

- `UseBieberWorksRateLimiting()` — global middleware, one IP-based policy for all requests except an allow-list (health checks by default).
- `RateLimiting.For(policyName, partitionKind)` — per-endpoint `IEndpointFilter` factory for Minimal APIs, declarative and composable with other filters.
- Client partitioning (both paths): IPv4-mapped IPv6 addresses count as IPv4, and IPv6 clients are grouped by network prefix (`RateLimitingMiddlewareOptions.IPv6PrefixLength`, default 64), so rotating addresses inside one /64 cannot create new buckets. A request without a client address gets **no** IP bucket and passes the IP limit (a warning is logged once per process; configure forwarded headers behind a proxy). `UserId` partitions use the stable id claim (`NameIdentifier`, then `sub`), and anonymous callers fall back to their IP partition. There are no shared `"unknown"`/`"anonymous"` buckets that one caller could fill for everyone.
- Both paths write the 429 response through the shared `RateLimitResponseWriter`, which resolves `IErrorLocalizer` from `HttpContext.RequestServices` (optional — falls back to a hardcoded English message) and sets the `Retry-After` header from `RateLimitResult.RetryAfter`.

## Admin UI

`RateLimitingViewModel` (framework-neutral) reads all registered code-default policies from `IRateLimitPolicyRegistry`, resolves each through the runtime `IRateLimitPolicyProvider`, and flags a policy as Settings-overridden when the resolved values differ from the code default. The MudBlazor page at `/admin/rate-limiting` renders this as a read-only table; it does not allow editing policies directly — Settings values are edited through the SDK-Settings admin UI using the `ratelimit:<policy>:<property>` keys.

## Logging and privacy

Partition values (e-mail addresses, IPs, user ids) are never written to logs. Limit events
log the policy name, the partition kind and a pseudonymous fingerprint (the first 12 hex
characters of SHA-256 over kind, value and secondary value), so events of the same partition
can be correlated without exposing the raw value. The fingerprint is computed only when the
respective log level is enabled.
