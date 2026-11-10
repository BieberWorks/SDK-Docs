# Getting Started

## Installation

```bash
dotnet add package BieberWorks.SDK.RateLimiting.Contracts
dotnet add package BieberWorks.SDK.RateLimiting
# Optional, only if the SDK-Admin shell is present in the host:
dotnet add package BieberWorks.SDK.RateLimiting.UI.Blazor.MudBlazor
```

## Registration

`Program.cs`:

```csharp
// Module discovery registers RateLimitingModule automatically (IModule convention).
// If SDK-Settings is also registered in the host, its overrides are picked up automatically;
// registration order relative to RateLimitingModule does not matter.
builder.Services.AddBieberWorksModules(); // discovers RateLimitingModule + all other IModule types
```

If you use the global IP-based middleware:

```csharp
app.UseBieberWorksRateLimiting();
```

## Behavior changes

These changes fix how clients are partitioned. Signatures are unchanged:

- **IPv6 grouping:** IPv6 clients are counted per /64 network instead of per address. Set `RateLimitingMiddlewareOptions.IPv6PrefixLength` (1-128) to change the prefix; it applies to the middleware and to `RateLimiting.For(...)` filters.
- **IPv4-mapped IPv6** (`::ffff:a.b.c.d`) counts as the IPv4 address.
- **Unknown client IP:** such requests are no longer collected in one shared `"unknown"` bucket. They pass IP-based limits, and a warning is logged once per process. Behind a reverse proxy, configure `UseForwardedHeaders` so the real client address is known.
- **User partitions** use the `NameIdentifier`/`sub` claim instead of `Identity.Name`. Anonymous callers are partitioned by IP instead of one shared `"anonymous"` bucket.

```csharp
builder.Services.Configure<RateLimitingMiddlewareOptions>(o => o.IPv6PrefixLength = 56);
```


## Store limits

The in-memory counter store is bounded. The defaults fit most hosts; override them if needed:

```csharp
using BieberWorks.SDK.RateLimiting.Options;

builder.Services.Configure<RateLimitingStoreOptions>(o =>
{
    o.MaxEntries = 100_000;          // all policies
    o.MaxEntriesPerPolicy = 50_000;  // per policy
    o.SweepInterval = TimeSpan.FromMinutes(1);
});
```

All values must be positive; invalid values fail at start-up.

## Registering a policy

Any module can register its own default policy at start-up (e.g. from an `IModuleInitializer` or directly during `RegisterServices`):

```csharp
using BieberWorks.SDK.RateLimiting.Contracts;

services.AddSingleton<IStartupFilter>(...); // or wherever your module wires things up

// somewhere with access to IRateLimitPolicyRegistry:
registry.Register(new RateLimitPolicy(
    Name: WellKnownRateLimitPolicies.Login,
    PermitLimit: 5,
    Window: TimeSpan.FromMinutes(15),
    LockoutDuration: TimeSpan.FromMinutes(15)));
```

## Checking a limit in application code

```csharp
using BieberWorks.SDK.RateLimiting.Contracts;

public sealed class LoginHandler
{
    private readonly IRateLimiter _rateLimiter;

    public LoginHandler(IRateLimiter rateLimiter) => _rateLimiter = rateLimiter;

    public async Task<Result> LoginAsync(string email, string ip, CancellationToken ct)
    {
        var partition = new RateLimitPartitionKey(RateLimitPartitionKind.Custom, ip, email);

        // Acquire first: the slot is taken before the expensive check, so concurrent
        // attempts cannot all slip through, and a configured lockout can start.
        var slot = await _rateLimiter.TryAcquireAsync(WellKnownRateLimitPolicies.Login, partition, ct);
        if (!slot.Allowed)
            return Result.Failure(DomainError.TooManyRequests("Auth.TooManyAttempts", slot.RetryAfter));

        if (!await CheckPasswordAsync(email, ct))
            return Result.Failure(DomainError.Unauthorized("Auth.InvalidCredentials"));

        // Reset on success: earlier failed attempts no longer count.
        await _rateLimiter.ResetAsync(WellKnownRateLimitPolicies.Login, partition, ct);
        return Result.Success();
    }
}
```

Do not gate with `PeekAsync`: it only reads, so concurrent requests all pass before any of them counts. Use it for display, e.g. remaining attempts or `RetryAfter`.

## Declarative per-endpoint limits (Minimal API)

```csharp
using BieberWorks.SDK.RateLimiting.Contracts;
using BieberWorks.SDK.RateLimiting.Endpoints;

app.MapPost("/login", LoginEndpoint.HandleAsync)
   .AddEndpointFilterFactory(RateLimiting.For(WellKnownRateLimitPolicies.Login, RateLimitPartitionKind.IpAddress));
```

## Settings override keys

When SDK-Settings is present in the host, any registered policy can be overridden per key:

| Key | Type | Example |
|---|---|---|
| `ratelimit:<policy>:limit` | int | `ratelimit:auth:login:limit` = `10` |
| `ratelimit:<policy>:window-seconds` | int | `ratelimit:auth:login:window-seconds` = `900` |
| `ratelimit:<policy>:lockout-seconds` | int (0 = no lockout) | `ratelimit:auth:login:lockout-seconds` = `900` |
| `ratelimit:<policy>:algorithm` | string (`FixedWindow`\|`SlidingWindow`) | `ratelimit:auth:login:algorithm` = `FixedWindow` |

Use `RateLimitSettingKeys.Limit(policyName)` etc. to build these keys instead of hardcoding strings.

## Admin UI

With `BieberWorks.SDK.RateLimiting.UI.Blazor.MudBlazor` and the SDK-Admin shell registered, a read-only "Policies" page appears at `/admin/rate-limiting`, listing every registered policy, its effective values, and whether it currently comes from a code default or a Settings override.
