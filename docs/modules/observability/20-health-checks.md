# Health Checks

## The `IHealthContributor` seam

Any module can contribute a health check without referencing OpenTelemetry or `Microsoft.Extensions.Diagnostics.HealthChecks` types:

```csharp
// in a fach-module, referencing only BieberWorks.SDK.Observability.Contracts
internal sealed class SignalRHubHealthContributor : IHealthContributor
{
    public string Name => "notifications-signalr";
    public IReadOnlySet<string> Tags { get; } = new HashSet<string> { "ready" };

    public Task<BwHealthCheckResult> CheckAsync(CancellationToken ct) =>
        Task.FromResult(_hubIsResponsive
            ? BwHealthCheckResult.Healthy()
            : BwHealthCheckResult.Degraded("Hub not accepting connections"));
}

// in the module's IModule.RegisterServices:
services.AddSingleton<IHealthContributor, SignalRHubHealthContributor>();
```

## Tags

- `ready` — counted toward `/health` (readiness — should this instance receive traffic?)
- `live` — counted toward `/alive` (liveness — is the process healthy enough to keep running?)

A contributor can carry both tags.

## Aggregation and adapter (opt-in)

The aggregation is switched on with `BieberWorksObservabilityOptions.UseContributorAggregation = true`. By default it is off, so hosts that do not use the contributor seam do not get two always-healthy entries (`bieberworks-ready`, `bieberworks-live`) in their health report.

With the option set, `Observability` (impl) discovers all registered `IHealthContributor` instances via `IEnumerable<IHealthContributor>` — no central registry required — and wraps each one in an internal `HealthContributorAdapter : IHealthCheck` that maps `BwHealthCheckResult` to the native `HealthCheckResult`:

| `BwHealthStatus` | Maps to |
|---|---|
| `Healthy` | `HealthCheckResult.Healthy` |
| `Degraded` | `HealthCheckResult.Degraded` |
| `Unhealthy` | `HealthCheckResult.Unhealthy` |

The adapters are registered with the standard ASP.NET Core `AddHealthChecks()` pipeline, so `/health` and `/alive` are ordinary ASP.NET Core health check endpoints under the hood.

## Endpoints

`MapBieberWorksHealthEndpoints()` maps `/health` (checks tagged `ready`) and `/alive` (checks tagged `live`). **Untagged checks are not part of either endpoint**; tag your own `IHealthCheck` registrations explicitly.

### Collision with ServiceKit

`MapBieberWorksServiceHost` (ServiceKit) maps `/health` and `/alive` too. Hosts that use it must not call `MapBieberWorksHealthEndpoints`. The host is protected against the mistake: at startup it inspects the final endpoint set (so the order of the two calls does not matter) and, if an endpoint of `MapBieberWorksHealthEndpoints` shares a route and HTTP method with another endpoint, it logs an error and throws an `InvalidOperationException` that names the route. Without the guard such a host would start and answer HTTP 500 (`AmbiguousMatchException`) on both paths, and its container health check would fail forever.

## Health as metrics

Independent of the endpoints, the results of all registered health checks are published as metrics when telemetry is enabled; see [Metrics and Tracing](30-metrics-and-tracing.md#health-metrics).

## Generic EF Core contributor

```csharp
services.AddDbContextHealthContributor<AppDbContext>("db", "ready");
```

Performs `Database.CanConnectAsync()` against the given `DbContext`; no custom code required per module.
