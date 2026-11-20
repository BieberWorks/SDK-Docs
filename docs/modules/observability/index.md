# Observability

The Observability module wires OpenTelemetry (metrics, tracing) and ASP.NET Core health checks into a BieberWorks host without requiring .NET Aspire. It replaces hand-written `ServiceDefaults` boilerplate with a reusable SDK package and lets any other SDK module contribute a health check via a lightweight seam, without pulling OpenTelemetry or `Microsoft.Extensions.Diagnostics.HealthChecks` types into that module.

## What the module offers

- **`IHealthContributor` seam** — modules implement one interface and register it via DI; no shared registry, no dependency on OpenTelemetry/HealthChecks types
- **`BwHealthCheckResult` / `BwHealthStatus`** — framework-agnostic DTO (`Healthy`/`Degraded`/`Unhealthy`) returned by contributors, mapped internally to the native ASP.NET Core `HealthCheckResult`
- **`AddBieberWorksObservability`** — opt-in (`Observability:Enabled`) OpenTelemetry wiring for traces, metrics and logs over OTLP (`http/protobuf` by default, `grpc` optional; endpoint, headers and signals configurable), all `BieberWorks.SDK.*` meters and sources, resource attributes including `service.version`, probe requests filtered from traces, health check results as metrics
- **`MapBieberWorksHealthEndpoints`** — maps `/alive` (tag `live`) and `/health` (tag `ready`) in all environments; a startup guard refuses to start when another endpoint (ServiceKit) maps the same routes
- **`BwInstrumentConformance`** — test helper that checks a module's instruments against the naming convention
- **`Observability.Npgsql`** — optional package for database traces and metrics
- **`AddDbContextHealthContributor<T>`** — generic EF Core connectivity contributor for any `DbContext`, no custom code required

## Package overview

| Package | Description | When needed |
|---|---|---|
| `BieberWorks.SDK.Observability.Contracts` | `IHealthContributor`, `BwHealthCheckResult`, `BwHealthStatus`, `BwTelemetryNaming` — no OpenTelemetry/HealthChecks dependency | When a module contributes a health check or needs the telemetry naming convention |
| `BieberWorks.SDK.Observability` | OTel wiring, health metrics, health-check aggregation adapter (opt-in), endpoint mapping | In every host that exports telemetry or exposes health endpoints |
| `BieberWorks.SDK.Observability.Npgsql` | Npgsql traces and metrics on top of the stable `Npgsql.OpenTelemetry` | Hosts that use PostgreSQL and want database telemetry |

::: tip Versioning
All packages share one version, computed from Conventional Commits. The latest release and full history live on the [GitHub Releases page](https://github.com/BieberWorks/SDK-Observability/releases) (see [changelog](90-changelog.md)).
:::

## When to use which package

| Scenario | Required packages |
|---|---|
| Module contributes a health check for its own DbContext/dependency | `Observability.Contracts` |
| Host wires OpenTelemetry + health endpoints | `Observability` |

## Documentation

| Topic | Document |
|---|---|
| Wiring `AddBieberWorksObservability`, `MapBieberWorksHealthEndpoints`, options reference | [Getting Started](10-getting-started.md) |
| `IHealthContributor` seam, tags (`ready`/`live`), adapter pattern | [Health Checks](20-health-checks.md) |
| Naming convention, configuration model, OTLP, health metrics, Npgsql | [Metrics and Tracing](30-metrics-and-tracing.md) |
| Connecting a service (ServiceKit host, collector, headers, checklist) | [Services Integration](50-services-integration.md) |
| Side-by-side comparison with hand-written Aspire `ServiceDefaults` | [Migration from Aspire](40-migration-from-aspire.md) |
| Release history | [Changelog](90-changelog.md) |
