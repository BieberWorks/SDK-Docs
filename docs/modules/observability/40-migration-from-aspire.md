# Migration from Aspire ServiceDefaults

Consumer apps using .NET Aspire's `ServiceDefaults` template (see e.g. SkylineNord's `aspire/ServiceDefaults/Extensions.cs`) can migrate incrementally:

| Aspire `ServiceDefaults` | SDK-Observability equivalent |
|---|---|
| `builder.ConfigureOpenTelemetry()` + `builder.AddDefaultHealthChecks()` | `builder.AddBieberWorksObservability()` |
| `app.MapDefaultEndpoints()` | `app.MapBieberWorksHealthEndpoints()` |
| Single hard-coded `"self"` health check | Module-contributed `IHealthContributor` instances (e.g. `AddDbContextHealthContributor<AppDbContext>("db", "ready")`) |
| `/health`/`/alive` mapped only in `IsDevelopment()` | Mapped in all environments by default (`ExposeHealthEndpoints = true`); gate via reverse proxy/network policy for production |

`builder.Services.AddServiceDiscovery()` and `ConfigureHttpClientDefaults(...)` remain Aspire-specific concerns and stay in the consumer app's own `ServiceDefaults` — this SDK module is intentionally Aspire-independent and works standalone in any ASP.NET Core host.

Migration is additive: both can coexist temporarily while a consumer app migrates health checks module by module.
