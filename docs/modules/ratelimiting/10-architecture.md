# Architecture

## Tier split: Contracts vs. Impl

`RateLimiting.Contracts` references only `BieberWorks.SDK.SharedKernel` (Tier 1). It defines `IRateLimiter`, the DTOs, `IRateLimitPolicyProvider`, and `IRateLimitPolicyRegistry` — no reference to SDK-Settings. This lets Tier-2 modules (e.g. Auth) reference `RateLimiting.Contracts` without a tier cycle.

The Settings integration lives exclusively in the Impl package `BieberWorks.SDK.RateLimiting`, via an *optional-at-runtime* `PackageReference` to `BieberWorks.SDK.Settings.Contracts`. The package compiles against `ISettingsService`, but `RateLimitingModule.RegisterServices` only wires the Settings-backed provider when `ISettingsService` is already registered in the host:

```csharp
var settingsIsRegistered = services.Any(d =>
    d.ServiceType.FullName == "BieberWorks.SDK.Settings.Contracts.ISettingsService");

if (settingsIsRegistered)
    services.TryAddSingleton<IRateLimitPolicyProvider, SettingsBackedRateLimitPolicyProvider>();
else
    services.TryAddSingleton<IRateLimitPolicyProvider, DefaultRateLimitPolicyProvider>();
```

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
    Task<RateLimitCounterState> IncrementAsync(string key, TimeSpan window, CancellationToken ct);
    Task<RateLimitCounterState?> PeekAsync(string key, CancellationToken ct);
    Task SetLockoutAsync(string key, TimeSpan duration, CancellationToken ct);
    Task ResetAsync(string key, CancellationToken ct);
}
```

Only `InMemoryRateLimitStore` (a `ConcurrentDictionary`-backed, fixed-window implementation) ships in this release. It is process-local — not shared across horizontally scaled instances. A future `BieberWorks.SDK.RateLimiting.Redis` package would supply an alternative `IRateLimitStore` without touching `IRateLimiter` callers.

## No DbContext

Rate limit state is intentionally volatile (counters with a TTL). Persisting it would contradict the purpose and add DB load to a hot path. Policy *configuration* (the override values) is what SDK-Settings persists — not the counters themselves.

## ASP.NET integration

- `UseBieberWorksRateLimiting()` — global middleware, one IP-based policy for all requests except an allow-list (health checks by default).
- `RateLimiting.For(policyName, partitionKind)` — per-endpoint `IEndpointFilter` factory for Minimal APIs, declarative and composable with other filters.
- Both paths write the 429 response through the shared `RateLimitResponseWriter`, which resolves `IErrorLocalizer` from `HttpContext.RequestServices` (optional — falls back to a hardcoded English message) and sets the `Retry-After` header from `RateLimitResult.RetryAfter`.

## Admin UI

`RateLimitingViewModel` (framework-neutral) reads all registered code-default policies from `IRateLimitPolicyRegistry`, resolves each through the runtime `IRateLimitPolicyProvider`, and flags a policy as Settings-overridden when the resolved values differ from the code default. The MudBlazor page at `/admin/rate-limiting` renders this as a read-only table; it does not allow editing policies directly — Settings values are edited through the SDK-Settings admin UI using the `ratelimit:<policy>:<property>` keys.
