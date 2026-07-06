# RateLimiting

The RateLimiting module provides a generic, reusable rate limiting abstraction (IP / User / Endpoint / named policy) for BieberWorks SDK hosts. It replaces ad-hoc, hardcoded `IMemoryCache`-based limiters with a configurable, in-memory implementation that optionally reads policy overrides from SDK-Settings — with zero required dependency on any other SDK module.

## What the module offers

- **Named policies** — `RateLimitPolicy` (limit, window, algorithm, optional lockout) resolved by name at call time via `IRateLimitPolicyProvider`
- **Partitioning** — `RateLimitPartitionKind.IpAddress` / `UserId` / `Endpoint` / `Custom`, composable via `RateLimitPartitionKey`
- **In-memory default implementation** — `InMemoryRateLimiter` backed by an internal `IRateLimitStore` seam (single-process; a distributed/Redis-backed store is a future, non-breaking addition)
- **Code-default policies with optional Settings override** — `IRateLimitPolicyRegistry` holds code defaults; `SettingsBackedRateLimitPolicyProvider` overrides them via `ratelimit:<policy>:<property>` keys, only when SDK-Settings is present in the host
- **ASP.NET Core integration** — `UseBieberWorksRateLimiting()` global IP-based middleware, plus `RateLimitEndpointFilter`/`RateLimiting.For(...)` for declarative per-endpoint limits on Minimal APIs
- **429 responses** — `Retry-After` header + `IErrorLocalizer`-backed JSON body, no domain exceptions used for control flow
- **Admin UI** — read-only `/admin/rate-limiting` overview page showing each policy's effective values and whether they come from a code default or a Settings override

## Package overview

| Package | Description | When needed |
|---|---|---|
| `BieberWorks.SDK.RateLimiting.Contracts` | `IRateLimiter`, `RateLimitPolicy`, `RateLimitPartitionKey`, `RateLimitResult`, `IRateLimitPolicyProvider`, `IRateLimitPolicyRegistry`, `RateLimitSettingKeys`, `WellKnownRateLimitPolicies` — no implementation dependency, only `SharedKernel` | Any module that needs to check/consume rate limit quota, or register a code-default policy |
| `BieberWorks.SDK.RateLimiting` | In-memory `IRateLimiter`, policy providers, ASP.NET middleware/endpoint filter, `IModule` registration | In every host that enforces rate limits |
| `BieberWorks.SDK.RateLimiting.Presentation` | Framework-neutral `IAdminSection` + `RateLimitingViewModel` for the Policies overview | When the SDK-Admin shell is present in the host |
| `BieberWorks.SDK.RateLimiting.UI.Blazor` / `.UI.Blazor.MudBlazor` | Blazor adapter base class + MudBlazor admin page at `/admin/rate-limiting` | When the SDK-Admin shell is present in the host |

::: tip Versioning
All packages share one version, computed from Conventional Commits. The latest release and full history live on the [GitHub Releases page](https://github.com/BieberWorks/SDK-RateLimiting/releases) (see [changelog](90-changelog.md)).
:::

## When to use which package

| Scenario | Required packages |
|---|---|
| Consumer/module code checks or consumes rate limit quota | `RateLimiting.Contracts` |
| Module registers its own default policy (e.g. Auth's login attempts) | `RateLimiting.Contracts` (`IRateLimitPolicyRegistry`) |
| Host needs the in-memory limiter, middleware, or endpoint filter | `RateLimiting` |
| Host includes the SDK-Admin shell | `RateLimiting` + `RateLimiting.UI.Blazor.MudBlazor` |

## Documentation

| Topic | Document |
|---|---|
| Tier split rationale, Settings-optional detection pattern, store seam, policy resolution flow | [Architecture](10-architecture.md) |
| NuGet references, `Program.cs` registration, policy registration, middleware/endpoint filter usage, Admin UI, Settings override keys | [Usage Guide](01-getting-started.md) |
| Release history | [Changelog](90-changelog.md) |
