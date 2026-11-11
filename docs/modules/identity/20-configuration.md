# Configuration

| Key | Default in the image | Meaning |
| --- | --- | --- |
| `ConnectionStrings:AuthDb` | none (required) | PostgreSQL for the `auth` schema |
| `ConnectionStrings:ServiceDb` | `AuthDb` | PostgreSQL for the transport tables (schema `servicekit`) |
| `JwtSettings:Issuer` | none (required) | Issuer string; services must use the same value as `Authority` |
| `JwtSettings:Audience` | `identity` | Audience of tokens for this service |
| `JwtSettings:AdditionalAudiences` | `["communication"]` | Services that accept user tokens. Never put a service-token audience here |
| `JwtSettings:IncludePermissionClaims` | `true` | Add role permissions as `perm` claims |
| `JwtSettings:SigningMode` | `Asymmetric` | ES256 with JWKS |
| `JwtSettings:AccessTokenExpirationMinutes` | `15` | Access token lifetime |
| `BieberWorks:Auth:JwtSigning:*` | none (required) | `ActiveKid` and `Keys` (`Kid`, `PrivateKeyFile` for the active key, `PublicKeyPem` for retired keys). Inline `PrivateKeyPem` only in Development |
| `BieberWorks:Auth:ServiceAccounts:Accounts` | relay account | Service accounts (`identity-relay` may request tokens for the dedicated audience `communication-service` with `email:send`). The audience of a service account must never appear in `JwtSettings:Audience` or `AdditionalAudiences`: the start is refused, because such a token would be accepted by this API as a bearer token |
| `Identity:Relay:TargetAudiences` | `communication -> communication-service` | Subscriber name to the audience requested for the relay's service token (a subscriber without an entry gets its own name). The subscriber name stays the key of `ServiceEndpoints:Services` and `ServiceTransport:Subscriptions` |
| `ServiceEndpoints:Services:<name>` | none | Service name to base URL; the only place where service addresses live |
| `ServiceHost:InboxEnabled` / `InboxPolicy` | `false` / `perm:identity:events:receive` | Identity receives no events, so `/internal/events` is not mapped (the ServiceKit RC pin supports this); the policy additionally keeps ordinary user tokens (audience `identity`) out, because nobody holds that permission |
| `ServiceTransport:Mode` | `Http` | `Http` or `InMemory` (single-process tests only) |
| `ServiceTransport:Subscriptions` | `email.mail-requested -> communication` | Event type to subscriber services |
| `BieberWorks:Auth:MailQueue:Durable` | `true` | Auth mail jobs are stored in the Auth database (not in memory) and survive a process kill |
| `Identity:ForwardedHeaders:KnownProxies` / `KnownNetworks` | none | Frontends or proxies (addresses / CIDR networks) that may tell identity the browser's address in `X-Forwarded-For`. Sign-in throttling and the session list use that address. Without an entry the header is ignored and every user behind a frontend shares the frontend's address (one attacker can then throttle everybody). Only `X-Forwarded-For` is honoured, never scheme or host |
| `BieberWorks:Auth:SignIn:FailureBrake:*` | `Enabled=false` | Optional brake for failed sign-ins per client address (delay, concurrency caps). Off in the image; read the activation checklist in [operations](50-operations.md#sign-in-brake-per-client-address) before switching it on |
| `App:PublicBaseUrl` | none | Base URL of the frontend for links in mails |
| `Auth:Bootstrap:*` | off | Seed an administrator |
| `ServiceTransport:Postgres:*Retention` | 7 d delivered / 30 d inbox / 90 d dead | Retention of outbox and inbox rows (see the ServiceKit docs); mail payloads are emptied on delivery |
| `BieberWorks:Auth:MailQueue:DeadPayloadRetention` | `7.00:00:00` | Dead mail jobs lose their clear-text token payload after this time |

## Logging and log rotation

The image sets `Microsoft.EntityFrameworkCore.Database.Command` to `Warning`; otherwise every SQL statement is logged
at `Information` (around 90 % of all lines). Raise it temporarily with
`Logging__LogLevel__Microsoft.EntityFrameworkCore.Database.Command=Information` when debugging.

The service writes to the console only. Limit the container log size in your runtime, for example in Compose:
`logging: { driver: json-file, options: { max-size: "10m", max-file: "5" } }`.

## Operations settings

| Key | Default | Meaning |
| --- | --- | --- |
| `Database:ConnectTimeout` / `CommandTimeout` | `00:00:03` / `00:00:10` | Added to `AuthDb` and `ServiceDb` unless the connection string sets `Timeout` / `Command Timeout` itself |
| `Database:RetryCount` / `MaxRetryDelay` | `1` / `00:00:01` | Retry budget of failed database calls (the Auth module alone retries 6 times for over a minute) |
| `Database:RefuseNewerSchema` | `false` | Stop the start when the database has migrations this build does not know (rollback against a newer schema); otherwise it is logged as an error |
| `RateLimiting:Policies:<key>:PermitLimit` / `Window` / `LockoutDuration` | Auth defaults | Override a rate limit, see [operations](50-operations.md) |
| `RateLimiting:DefaultRetryAfter` | `00:01:00` | `Retry-After` of a 429 when the limiter could not tell the wait |
| `OpenApi:Enabled` / `RequireAuthorization` | `true` / `false` | Serve `/openapi/v1.json`, optionally only to authenticated callers |
| `ServiceHost:InfoRequiresAuthorization` | `false` | Same for `/info` |
| `ServiceHost:Metrics:*` | off | Opt-in Prometheus endpoint (token or explicit `AllowAnonymous`) |
