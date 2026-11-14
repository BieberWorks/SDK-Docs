# Telemetry

The Auth module reports metrics and traces with BCL types only (`System.Diagnostics.Metrics`, `System.Diagnostics.ActivitySource`). It has no OpenTelemetry dependency; the host decides what to export. Subscribe to the meter and the activity source `BieberWorks.SDK.Auth`:

```csharp
builder.Services.AddOpenTelemetry()
    .WithMetrics(m => m.AddMeter("BieberWorks.SDK.Auth", "BieberWorks.SDK.RateLimiting"))
    .WithTracing(t => t.AddSource("BieberWorks.SDK.Auth"));
```

Names follow the SDK telemetry naming convention (`bieberworks.{module}.{name}`, UCUM units, bounded tags). Tag values are fixed sets; an e-mail address, user name, IP address or token is never a tag.

## Metrics

| Instrument | Unit | Tag | Allowed values |
|---|---|---|---|
| `bieberworks.auth.login.attempts` | `{attempt}` | `outcome` | `success`, `two_factor`, `invalid_credentials`, `locked_out`, `email_unconfirmed`, `rate_limited`, `brake_rejected`, `error` |
| `bieberworks.auth.login.brake.delay` | `s` | none | Histogram of the delay the sign-in brake imposed (bounds 0.05 to 30 s) |
| `bieberworks.auth.tokens.issued` | `{token}` | `type` | `access`, `refresh`, `service` |
| `bieberworks.auth.tokens.refreshes` | `{refresh}` | `outcome` | `success`, `invalid_request`, `invalid_token`, `reuse_detected`, `locked_out`, `email_unconfirmed` |
| `bieberworks.auth.registrations` | `{registration}` | `outcome` | `success`, `disabled`, `rate_limited`, `already_registered`, `failed` |
| `bieberworks.auth.email.send_failures` | `{failure}` | `kind` | mail kind (`email_confirmation`, `password_reset`, `two_factor_code`, `account_exists_notice`, `registration_follow_up`, `password_reset_request`, `confirmation_request`) |
| `bieberworks.auth.email.queue_dropped` | `{mail}` | `kind` | as above |

Notes:

- `rate_limited` is the per-address-and-account sign-in limit (or the two-factor resend limit); `brake_rejected` is the sign-in brake (see [Getting started](01-getting-started.md)). Both answer `429`.
- `two_factor` means the password was correct and a code was sent; the sign-in completes with the verify call, which issues the tokens.
- Every sign-in or refresh that succeeds issues one `access` and one `refresh` token. `service` counts tokens of the service-token endpoint.
- With uniform registration responses the counter reports `success` for new and known addresses alike, so it reveals nothing the response does not.
- The Prometheus names are `bieberworks_auth_login_attempts_total`, `bieberworks_auth_login_brake_delay_seconds_bucket`, `bieberworks_auth_tokens_issued_total`, and so on.

### Rate limit decisions

The built-in fallback limiter (used when `SDK-RateLimiting` is not part of the host) reports every check through the shared contract of `BieberWorks.SDK.RateLimiting.Contracts`: `bieberworks.ratelimiting.decisions{policy,outcome}` on the meter `BieberWorks.SDK.RateLimiting`. Rejections of the sign-in brake policy therefore show up even in a host that only references Auth. Subscribe to that meter as well.

## Traces

Span `auth.mail.deliver` (kind `consumer`, tag `kind`) wraps the background delivery of one mail. The queue records the `traceparent` of the request that queued the mail, so registration, mail job and the hand-over to the mail service form one trace. This works for both queues:

- the in-memory queue carries the `traceparent` with the job;
- the durable queue stores it in the nullable column `auth."MailJobs"."TraceParent"` (migration `AddMailJobTraceParent`, additive; rows written before the migration have no value and start a trace of their own).

A mail queued while no activity is current (for example by a background job) starts its own trace. Only the exception type is attached to a failed span, never its message.

## Route names

All endpoints of the module use route templates with a leading slash (`/api/auth/login`, `/api/admin/users/{userId}`), so the `http.route` label is consistent with every other route of the host. Dashboards that filtered on `api/auth/...` must use the new form.
