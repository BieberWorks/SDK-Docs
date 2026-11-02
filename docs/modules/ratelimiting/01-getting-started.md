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
        var result = await _rateLimiter.TryAcquireAsync(
            WellKnownRateLimitPolicies.Login,
            RateLimitPartitionKey.ForIp(ip),
            ct);

        if (!result.Allowed)
            return Result.Failure(DomainError.Failure("Auth.TooManyAttempts"));

        // ... proceed with login
    }
}
```

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
