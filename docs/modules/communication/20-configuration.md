# Configuration

| Key | Default in the image | Meaning |
| --- | --- | --- |
| `ConnectionStrings:EmailDb` | none (required) | PostgreSQL for the `email` schema |
| `ConnectionStrings:ServiceDb` | `EmailDb` | PostgreSQL for the transport tables (schema `servicekit`) |
| `ServiceHost:Jwt:Authority` | none (required) | Issuer of the identity service |
| `ServiceHost:Jwt:MetadataAddress` | `<Authority>/.well-known/openid-configuration` | OpenID discovery document |
| `ServiceHost:Jwt:Audience` | `communication` | Expected audience of user tokens |
| `Communication:ServiceAudience` | `communication-service` | Second accepted audience, for service tokens. It must not be an audience of the issuing API (identity), so a service token is useless there |
| `ServiceHost:Jwt:AllowInsecureMetadata` | `false` | Allow plain http metadata (internal networks only) |
| `ServiceHost:InboxPolicy` | `perm:email:send` | Policy of `/internal/events` |
| `Email:Queue:Enabled` | `true` | Queued sending API and dispatcher |
| `Email:Queue:PollInterval` / `BaseRetryDelay` / `MaxAttempts` | 2 s / 5 s / 8 | Dispatcher behaviour |
| `Email:UseSmtp`, `Email:Host`, `Email:Port`, `Email:From`, `Email:SecurityMode` | none | Mail server (see the Email module docs) |
| `Email:Queue:SentRetention` / `FailedRetention` | 7 d / 30 d | Sent and failed queue rows are deleted after this time; keep `SentRetention` above the redelivery window (3 days) |
| `ServiceTransport:Postgres:*Retention` | 7 d delivered / 30 d inbox / 90 d dead | Retention of outbox and inbox rows (see the ServiceKit docs) |

## Logging and log rotation

The image sets `Microsoft.EntityFrameworkCore.Database.Command` to `Warning`; otherwise every SQL statement is logged
at `Information`. Raise it temporarily with `Logging__LogLevel__Microsoft.EntityFrameworkCore.Database.Command=Information`
when debugging.

The service writes to the console only. Limit the container log size in your runtime, for example in Compose:
`logging: { driver: json-file, options: { max-size: "10m", max-file: "5" } }`.

## Operations settings

| Key | Default | Meaning |
| --- | --- | --- |
| `Database:ConnectTimeout` / `CommandTimeout` | `00:00:03` / `00:00:10` | Added to `EmailDb` and `ServiceDb` unless the connection string sets `Timeout` / `Command Timeout` itself |
| `Database:RetryCount` / `MaxRetryDelay` | `1` / `00:00:01` | Retry budget of failed database calls (the Email module alone retries 6 times for over a minute) |
| `Database:RefuseNewerSchema` | `false` | Stop the start when the database has migrations this build does not know (rollback against a newer schema); otherwise it is logged as an error |
| `Communication:Health:PollInterval` | `00:00:15` | How often the mail queue numbers are read |
| `Communication:Health:PendingDegradedAfter` | `00:10:00` | A waiting mail older than this makes `/health` Degraded |
| `Communication:Health:BacklogDegradedAt` | `1000` | Waiting mails from which `/health` is Degraded |
| `Communication:Health:FailedLookback` | `1.00:00:00` | Mails that gave up within this period make `/health` Degraded (zero ignores them) |
| `OpenApi:Enabled` / `RequireAuthorization` | `true` / `false` | Serve `/openapi/v1.json`, optionally only to authenticated callers |
| `ServiceHost:InfoRequiresAuthorization` | `false` | Same for `/info` |
| `ServiceHost:Jwt:Authority` | none (required) | An empty value stops a Production start (`ServiceHost:Jwt:AllowEmptyAuthority` opts out) |
| `ServiceHost:Metrics:*` | off | Opt-in Prometheus endpoint (token or explicit `AllowAnonymous`) |
