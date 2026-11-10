# Configuration

| Section | Key | Default | Meaning |
| --- | --- | --- | --- |
| `ServiceEndpoints` | `Services:<name>` | none | Base URL of each service (the only place addresses are configured) |
| `ServiceResilience` | `Timeout` | 3 s | Timeout of a synchronous service call |
| | `MaxRetries` | 1 | Retries (minimum 1) |
| | `BreakerMinimumThroughput` / `BreakerSamplingDuration` / `BreakerBreakDuration` | 5 / 30 s / 30 s | Circuit breaker. HTTP 429 (the callee throttles a caller) is neither retried nor counted as a failure, so one flooding caller cannot open the breaker for everybody |
| `ServiceStatus` | `Interval` / `Timeout` / `HealthPath` | 10 s / 2 s / `health` | Status poller |
| `ServiceTransport` | `Mode` | `Http` | `Http` or `InMemory` |
| | `ServiceName` | `unknown` | Written to `SourceService` |
| | `MaxAttempts` / `MaxRetryAge` / `BaseBackoff` / `MaxBackoff` | 0 (none) / 3 d / 2 s / 10 min | Retry budget and dead-letter |
| | `DeferredRetryDelay` | 15 s | Re-check interval for entries waiting on a missing subscriber address (never dead-lettered) |
| | `BatchSize` / `PollInterval` | 50 / 1 s | Relay loop |
| | `Subscriptions:<eventType>` | none | HTTP only: list of subscriber service names |
| `ServiceTransport:Circuit` | `Enabled` / `BreakDuration` | `true` / 5 s | Fail-fast circuit per database server: after a connection failure new connections fail at once for the break, then one probe (see [operations](50-operations.md#database-outage)) |
| `ServiceHost` | `ServiceName`, `ServiceVersion`, `ApiVersion`, `Commit`, `Modules:<name>` | | Published by `/info`, together with `sdkPackages` (the real versions of all loaded `BieberWorks.SDK.*` assemblies) |
| `ServiceHost:Jwt` | `RefreshInterval` / `AutomaticRefreshInterval` | 30 s / 10 min (minimum 1 s / 5 min) | Minimum delay between forced key refreshes (a token with an unknown `kid` triggers one) and the unconditional refresh interval; a rotated key is accepted within `RefreshInterval`, a removed key is rejected after the next unconditional refresh |
| `ServiceHost:Jwt` | `WarmupRetry` | 5 s | Delay between attempts to load the issuer keys at start. `/health` reports the `jwks` check as `Degraded` until the keys were loaded once (tokens get 401 until then); afterwards it stays `Healthy` even while the issuer is down (cached keys) |
| | `InboxEnabled` | `true` | `false` does not map `/internal/events` at all; set it on a service that receives no events |
| | `InboxRequiresAuthorization` | `true` | Protects `/internal/events` |
| | `IgnoreUnknownEventTypes` | `false` | `false`: an event type without handler is answered 422 (dead-lettered at the sender). `true`: acknowledged (202) with a warning and the `servicekit.events.unhandled` metric |
| | `InboxPolicy` | none | Authorization policy of the inbox (for example `perm:email:send`). Without it every valid token with this service's audience may post events, so set it whenever user tokens carry the same audience |
| | `Jwt:Authority` / `Audience` / `MetadataAddress` | | Issuer, expected audience (service name), OpenID discovery document address (default `<Authority>/.well-known/openid-configuration`, which must serve `issuer` and `jwks_uri`; a raw JWKS URL does not work) |
| | `HealthCheckTimeout` / `DependencyRetryAfter` | 1.5 s / 5 s | Hard bound per health check (also for checks that ignore cancellation); `Retry-After` of the 503 during a database outage (see [operations](50-operations.md)) |
| | `InfoRequiresAuthorization` / `InfoPolicy` | `false` / none | Restrict `/info` to authenticated callers |
| | `Metrics:Enabled` / `Path` / `BearerToken` / `AllowAnonymous` / `Meters` | `false` / `/metrics` / none / `false` / see doc | Opt-in Prometheus endpoint; needs a token or an explicit `AllowAnonymous` |
| | `Jwt:AllowEmptyAuthority` | `false` | An empty `Authority` stops a Production start unless set |
| | `Jwt:ValidAlgorithms` | `ES256`, `RS256` | Accepted signature algorithms; a configured list replaces the default |
| | `Jwt:AllowInsecureMetadata` | `false` | Allow plain http JWKS (internal networks only) |

## Persistence

The default `IServiceOutbox` and `IServiceInbox` are in-memory. Production services call `AddServiceKitPostgresStores`
(package `ServiceKit.Transport.Postgres`, see [persistent stores](30-persistent-stores.md)) to keep both durable.
