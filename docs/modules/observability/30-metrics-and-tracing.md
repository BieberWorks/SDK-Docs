# Metrics and Tracing

## Naming convention

`BwTelemetryNaming` defines the naming convention used by every BieberWorks SDK module for its own `ActivitySource`/`Meter` instance:

```csharp
public static partial class BwTelemetryNaming
{
    public const string RootPrefix = "BieberWorks.SDK.";
    public const string InstrumentPrefix = "bieberworks.";
    public static string ForModule(string moduleName);                    // "BieberWorks.SDK.Notifications"
    public static string ForInstrument(string moduleName, string name);   // "bieberworks.ratelimiting.decisions"
    public static bool IsValidInstrumentName(string? instrumentName);
    public static bool IsValidUnit(string? unit);
}
```

- **Meter/ActivitySource:** `BieberWorks.SDK.{Module}`.
- **Instruments:** `bieberworks.{module}.{name}`: lower case, dot separated, underscores only in the last segment (`bieberworks.auth.email.send_failures`). The module part is lower-cased, so `RateLimiting` becomes `ratelimiting`.
- **Units:** UCUM as used by the OpenTelemetry semantic conventions (`s`, `By`, `1`, or an annotation such as `{event}`); never `ms`, `seconds` or `bytes`.

The full rules (tags and cardinality, histogram bucket advice, Prometheus translation, stability of telemetry names) are the workspace convention `telemetry-naming.md`. Modules do **not** reference this class at runtime.

### Conformance test for modules

`BwInstrumentConformance` (in `Observability.Contracts`, BCL only) checks every instrument of a meter against the convention: valid name, no `_total`/`_seconds` suffix, valid unit, description present, and bucket advice for every histogram measured in seconds. Modules call it from a test:

```csharp
MyModuleMetrics.Touch();   // make sure lazily created instruments exist
BwInstrumentConformance.FindViolations("BieberWorks.SDK.MyModule").ShouldBeEmpty();
```

A meter without instruments is reported as a violation, so a typo in the meter name cannot pass vacuously.

## Configuration

Everything is controlled by the `Observability` section; nothing is exported unless `Enabled` is `true`.

```json
{
  "Observability": {
    "Enabled": true,
    "Otlp": {
      "Endpoint": "http://collector:4318",
      "Protocol": "http/protobuf",
      "Timeout": "00:00:10",
      "Traces":  { "Endpoint": "https://tempo.example.com/v1/traces" },
      "Metrics": { "Headers": { "x-metrics-key": "from-a-secret" } }
    },
    "Signals": { "Traces": true, "Metrics": true, "Logs": true }
  }
}
```

| Key | Meaning |
|---|---|
| `Enabled` | Default `false`. Off means no provider, exporter, health publisher or log forwarding |
| `Otlp:Endpoint` | Base endpoint. For `http/protobuf` the path `/v1/traces`, `/v1/metrics` or `/v1/logs` is appended; for `grpc` it is used as given |
| `Otlp:Protocol` | `http/protobuf` (default) or `grpc`. The .NET SDK itself defaults to gRPC; this package deliberately defaults to the proxy-friendly HTTP variant |
| `Otlp:Headers` | Header name to value, sent with every export (API keys of hosted backends) |
| `Otlp:Timeout` | Export timeout, default 10 s |
| `Otlp:{Traces,Metrics,Logs}:Endpoint` | Full URL of one signal, used exactly as given |
| `Otlp:{Traces,Metrics,Logs}:Headers` | Headers of one signal, merged over the common ones per header name |
| `Signals:{Traces,Metrics,Logs}` | Switch a signal off. A signal that is off registers no provider |

**Secrets.** Supply header values only through a secret file or an environment variable (`Observability__Otlp__Headers__Authorization`), never a committed file. Header values are never logged; the startup log shows only the number of headers and `scheme://host:port` of the endpoint (no user info, path or query).

**Standard variables.** When `Enabled` is set, `OTEL_EXPORTER_OTLP_ENDPOINT`, `..._TRACES_ENDPOINT` (and `METRICS`, `LOGS`), `..._PROTOCOL`, `..._HEADERS` and `..._TIMEOUT` are respected. A signal-specific endpoint variable on its own exports that signal only. Precedence per signal, highest first: `Observability:Otlp:{Signal}`, signal `OTEL_*` variable, `Observability:Otlp`, general `OTEL_*` variable, default.

**Misconfiguration never stops the host.** An unknown protocol, a malformed endpoint or header, an invalid timeout or an unparsable section produces a warning at startup (through the host logger) and the affected signal (or, for an unparsable section, all of telemetry) stays off. `Enabled=true` without any endpoint wires the providers but exports nothing and warns.

**One metric path per service.** ServiceKit's own `/metrics` scrape and OTLP metric push would deliver duplicate series. Use one of them.

## What gets wired

When `Enabled` is set, per enabled signal:

- **Traces:** ASP.NET Core and `HttpClient` instrumentation plus the wildcard source `BieberWorks.SDK.*`. Requests below the probe paths (`/health`, `/alive`, `/metrics` by default) create no spans. The OTLP export calls themselves create no spans either (the SDK suppresses instrumentation while exporting).
- **Metrics:** ASP.NET Core, `HttpClient` and runtime instrumentation plus the wildcard meter `BieberWorks.SDK.*`, so the meters of every SDK module (ServiceKit, Auth, Email, RateLimiting, ...) are exported without central configuration, and the health metrics below. Telemetry about the telemetry is filtered out: requests below the probe paths are not counted in `http.server.*` (the framework switch `IHttpMetricsTagsFeature.MetricsDisabled`, set by a middleware that runs first), and the `http/protobuf` exporters send through an `HttpClient` whose instruments a metric view drops, so `http.client.*` only contains the service's own outgoing calls. The `grpc` transport builds its own channel; its calls are not filtered.
- **Logs:** forwarded through the OpenTelemetry logger provider with scopes (trace ids, correlation ids) and formatted messages. The exporter's own `HttpClient` log lines (`System.Net.Http.HttpClient.Otlp*`) are lowered to Warning to keep the console quiet.
- **Resource:** `service.name`, `service.version`, `service.namespace` (`bieberworks`), a generated `service.instance.id` and `deployment.environment.name`.

### Health metrics

The periodic result of the standard health check service (every registered `IHealthCheck`, including those of ServiceKit; no `MapBieberWorksHealthEndpoints` needed) becomes:

| Instrument | Type, unit | Meaning |
|---|---|---|
| `bieberworks.observability.health.status{check}` | gauge, `1` | Last result per check: 2 healthy, 1 degraded, 0 unhealthy |
| `bieberworks.observability.health.check.duration{check}` | histogram, `s` | Evaluation duration per check (buckets 5 ms to 60 s) |

Prometheus names: `bieberworks_observability_health_status` and `bieberworks_observability_health_check_duration_seconds_*`. The period is `HealthMetricsPeriod` (default 15 s).

## Database telemetry (optional package)

```csharp
builder.Services.AddBieberWorksNpgsqlObservability();   // BieberWorks.SDK.Observability.Npgsql
```

Adds the Npgsql tracing source and meter (stable `Npgsql.OpenTelemetry`). It is passive when observability or the signal is off. This replaces the former EF Core instrumentation option, because that OpenTelemetry package has no stable release.

## Removed in 0.1.0

The package never shipped a release before 0.1.0, so these were removed without a migration path: the Prometheus scrape endpoint (`EnablePrometheusEndpoint`, `MetricsPath`; ServiceKit serves `/metrics`) and `EnableEntityFrameworkInstrumentation` (use the Npgsql package). No beta OpenTelemetry package is referenced.
