# SDK-ServiceKit

Shared building blocks for running SDK modules as separate services. ServiceKit is a **library**, not a
service: every service host and every consumer frontend uses it, and no service repository depends on another.

## Packages

| Package | Purpose |
| --- | --- |
| `BieberWorks.SDK.ServiceKit.Client` | `ServiceEndpoints` (name to URL), resilience defaults (timeout, retry, circuit breaker), `IServiceStatusProvider` + poller, token forwarding |
| `BieberWorks.SDK.ServiceKit.Host` | `AddBieberWorksServiceHost` bootstrap: `/health`, `/alive`, `/info`, JWKS token validation, `/internal/events` inbox endpoint |
| `BieberWorks.SDK.ServiceKit.Transport.Contracts` | Framework-neutral transport seam: `ServiceEnvelope`, `IServiceEventPublisher`, `IServiceEventHandler`, `IServiceInbox`, `IServiceOutbox` |
| `BieberWorks.SDK.ServiceKit.Transport` | Runtime above the transport: outbox relay (retry, backoff, dead-letter), idempotent dispatcher, in-memory stores |
| `BieberWorks.SDK.ServiceKit.Transport.Http` | Default transport: `POST internal/events` to every subscriber |
| `BieberWorks.SDK.ServiceKit.Transport.Postgres` | Persistent outbox and inbox on PostgreSQL (`AddServiceKitPostgresStores`): survives restarts, several relays are safe (`SKIP LOCKED` + lease), outbox health check |
| `BieberWorks.SDK.ServiceKit.Transport.InMemory` | In-process transport for tests and the sandbox |

Status: pilot (0.x). The API may change until the pilot evaluation is complete.
