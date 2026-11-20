# Services Integration

How a BieberWorks service (for example Identity or Communication, both built on `ServiceKit.Host`) connects to the telemetry pipeline.

## Wiring

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.AddBieberWorksObservability();   // service.name/version from ServiceHost:*, environment from the host

// ... AddServiceKitHost(...) / module registration ...

var app = builder.Build();
app.MapBieberWorksServiceHost();      // ServiceKit: /health, /alive, /info, optional /metrics
// no app.MapBieberWorksHealthEndpoints() here
app.Run();
```

Services that register through `IServiceCollection` extension methods use `services.AddBieberWorksObservability(configuration, ...)` instead. The resource identity defaults to `ServiceHost:ServiceName`, `ServiceHost:ServiceVersion` and the host environment (`deployment.environment.name`), so no service repeats that mapping and telemetry always equals what `/info` reports. An explicit `Observability:ServiceName` (or a value set in the configure delegate) wins.

## Checklist

1. **Opt-in.** A service without `Observability:Enabled=true` behaves exactly as before.
2. **Endpoint.** `Observability__Otlp__Endpoint=http://collector:4318` (or the standard `OTEL_EXPORTER_OTLP_ENDPOINT`). Hosted backends that need an API key: `Observability__Otlp__Headers__<name>` from a secret file or environment variable, never from a committed file.
3. **One metric path.** Either OTLP push or the ServiceKit `/metrics` scrape (`ServiceHost:Metrics`). Both together produce duplicate series.
4. **No second health mapping.** `MapBieberWorksHealthEndpoints` and `MapBieberWorksServiceHost` both map `/health` and `/alive`; the host fails at startup with a clear message when both are used.
5. **Sampling.** Standard `OTEL_TRACES_SAMPLER` / `OTEL_TRACES_SAMPLER_ARG` apply.
6. **Databases.** `services.AddBieberWorksNpgsqlObservability()` from the `Observability.Npgsql` package adds database spans and metrics.
7. **Privacy.** Instrument tags and span attributes must never carry e-mail addresses, IP addresses, tokens or raw URLs (see the naming convention).

## What the pipeline delivers

- SDK meters of every module (`BieberWorks.SDK.*`): for example `bieberworks.servicekit.*`, `bieberworks.auth.*`, `bieberworks.email.*`, `bieberworks.ratelimiting.*` once those modules publish them.
- HTTP server metrics and spans without probe noise, `HttpClient` spans (trace context continues across services through W3C `traceparent`), runtime metrics.
- Logs with `trace_id`/`span_id` for correlation and the logging scope values.
- `bieberworks.observability.health.status{check}` for dashboards and alerts on service health.

## Troubleshooting

| Symptom | Cause |
|---|---|
| Nothing arrives | `Observability:Enabled` is not `true`, or no endpoint; the startup log states per signal whether it is exported |
| Only one signal arrives | A signal-specific `OTEL_EXPORTER_OTLP_<SIGNAL>_ENDPOINT` without a general endpoint exports that signal only |
| Startup warning `InvalidProtocol` / `InvalidEndpoint` | Fix the value; the signal stays off meanwhile, the service runs |
| Host fails with "route ... is mapped by MapBieberWorksHealthEndpoints and by another endpoint" | Remove `MapBieberWorksHealthEndpoints` in ServiceKit hosts |
| Duplicate metric series | OTLP push and `/metrics` scrape are both active |
