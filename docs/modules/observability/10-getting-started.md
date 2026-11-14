# Getting Started

## Install

```powershell
dotnet add package BieberWorks.SDK.Observability
dotnet add package BieberWorks.SDK.Observability.Npgsql   # optional: database traces and metrics
```

`Observability.Contracts` is pulled in transitively; reference it directly only if a module contributes an `IHealthContributor` or tests its instruments against the naming convention, without needing the OTel wiring.

## Wire it up

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.AddBieberWorksObservability(options =>
{
    options.ServiceName = "SkylineNord.Web";   // optional, defaults to the entry assembly name
    options.ServiceVersion = "1.4.0";          // optional, defaults to the assembly informational version
});

var app = builder.Build();
app.MapBieberWorksHealthEndpoints();           // not in hosts that use MapBieberWorksServiceHost, see below
app.Run();
```

Hosts that compose their services through `IServiceCollection` use the overload `services.AddBieberWorksObservability(configuration, ...)`; the standard `OTEL_*` variables are read from that `IConfiguration`, so it must include the environment variable provider (the default host builders do).

## Telemetry is opt-in

Without configuration nothing changes: no OpenTelemetry provider, no exporter, no health metric, no log forwarding. Switch it on and point it to a collector:

```json
{
  "Observability": {
    "Enabled": true,
    "Otlp": { "Endpoint": "http://collector:4318" }
  }
}
```

The full configuration model (signals, protocol, headers, per-signal overrides, `OTEL_*` precedence) is described in [Metrics and Tracing](30-metrics-and-tracing.md).

## `BieberWorksObservabilityOptions` reference

Bound from the `Observability` section; the `configure` delegate wins over configuration.

| Property | Default | Purpose |
|---|---|---|
| `Enabled` | `false` | Master switch for all telemetry. `OTEL_*` variables alone never switch it on |
| `ServiceName` | entry assembly name | `service.name` resource attribute |
| `ServiceVersion` | assembly informational version | `service.version` resource attribute |
| `ServiceNamespace` | `bieberworks` | `service.namespace` resource attribute |
| `Environment` | host environment name | `deployment.environment.name`; `OTEL_RESOURCE_ATTRIBUTES` wins |
| `Otlp` | see below | Endpoint, protocol, headers, timeout, per-signal overrides |
| `Signals` | all `true` | `Traces`, `Metrics`, `Logs` switches (effective once `Enabled` is set) |
| `ProbePaths` | `HealthPath`, `AlivePath`, `/metrics` | Requests below these paths create no spans. Setting a value replaces the defaults |
| `HealthMetricsPeriod` | 15 s | How often health checks are evaluated for the health metrics (minimum 1 s) |
| `UseContributorAggregation` | `false` | Register `bieberworks-ready` / `bieberworks-live` aggregating all `IHealthContributor` instances |
| `ExposeHealthEndpoints` | `true` | `MapBieberWorksHealthEndpoints` maps `/health` and `/alive` in all environments; gate access at the proxy or network level |
| `HealthPath` / `AlivePath` | `/health` / `/alive` | Paths of the endpoints |

## Hosts that use ServiceKit

`ServiceKit.Host` (`MapBieberWorksServiceHost`) already serves `/health`, `/alive`, `/info` and optionally `/metrics`. In such a host:

- call `AddBieberWorksObservability` and **do not call** `MapBieberWorksHealthEndpoints`;
- nothing to map: `service.name`, `service.version` and `deployment.environment.name` default to `ServiceHost:ServiceName`, `ServiceHost:ServiceVersion` and the host environment, so the resource attributes match `/info` (the `Observability` section and the configure delegate still override them);
- keep exactly one metric path per service: OTLP push **or** the ServiceKit `/metrics` scrape, not both.

If both map functions are called anyway, the host refuses to start with an `InvalidOperationException` that names the colliding route, in either call order (see [Health Checks](20-health-checks.md)). Without the guard the host would answer HTTP 500 (`AmbiguousMatchException`) on `/health` and `/alive`.
