# Operations

See also the ServiceKit operations guide (database outage behaviour, metrics, tracing, signing key rotation, `/info`
exposure); the settings below are specific to the identity image.

## Database outage

Connections time out after 3 s and commands after 10 s (`Database:*`), failed calls are retried once. A request that cannot
reach the database is answered **503 with `Retry-After`** (`ServiceHost:DependencyRetryAfter`, 5 s) instead of hanging, and
`/health` answers within 1.5 s (`ServiceHost:HealthCheckTimeout`) with `Unhealthy`. `/alive` stays 200, which is what the
image `HEALTHCHECK` uses, so an outage does not restart the container. The JWKS and discovery endpoints need no database
and keep answering, so consumers keep validating tokens.

From the ServiceKit version after `0.1.0-rc.0` on, a **fail-fast circuit** per database server (`ServiceTransport:Circuit`,
break 5 s) covers the Auth database context and the transport stores without configuration. Measured with a database that
accepts connections but never answers (a stopped container in a Docker network): the first request (sign-in) waits for one
connect timeout (3.1 s), the next ones (registration) are refused within milliseconds (0.01 s) and `/health` reports the
outage at once (0.01 s), even while its cached numbers are fresh. After the break one request probes the database; recovery
needs no restart. With the pinned `0.1.0-rc.0` every request waits for its own connect timeouts and the retry (measured
6.1 s per sign-in or registration with a hanging database; up to 12.5 s in the RC2 acceptance, where a request made several
database calls).

A 503 is not proof that nothing happened. A request refused by the open circuit before any database call changed nothing
(`outcomeUnknown: false`) and can be repeated. A write request (registration, password change) that timed out, lost its
connection or failed after an earlier database call of the same request may have been committed; the 503 body then says
`outcomeUnknown: true`. Clients must not repeat such a call blindly: check the state first (for example sign in) or expect
a conflict. Idempotent calls, which carry a message id, may be repeated.

## Rate limits

The Auth module ships fixed limits. Override them with configuration; the key is the policy name with every character that
is not a letter or digit replaced by `-`:

| Policy | Key | Default |
| --- | --- | --- |
| `auth:login` | `auth-login` | 5 per 1 min, lockout 15 min |
| `auth:2fa-verify` | `auth-2fa-verify` | 5 per 15 min, lockout 15 min |
| `auth:2fa-resend` | `auth-2fa-resend` | 1 per 60 s |
| `auth:register-ip` | `auth-register-ip` | 10 per 15 min per client address |
| `auth:forgot-password-ip` | `auth-forgot-password-ip` | 10 per 15 min per client address |
| `auth:confirmation-request-ip` / `-identifier` | `auth-confirmation-request-ip` / `-identifier` | 20 per 15 min / 3 per hour |

```
RateLimiting__Policies__auth-register-ip__PermitLimit=100
RateLimiting__Policies__auth-register-ip__Window=00:15:00
RateLimiting__Policies__auth-login__LockoutDuration=00:05:00   # 00:00:00 removes the lockout
```

Every 429 carries `Retry-After`: the remaining lockout or window when the limiter knows it, otherwise
`RateLimiting:DefaultRetryAfter`. The limits are counted per client address. Behind a frontend, a NAT or a reverse proxy
every user shares one address unless identity learns the browser's address: list the frontend in
`ServiceHost:ReverseProxy:KnownProxies` / `KnownNetworks`. Without that, a limit such as registration blocks all users behind
the proxy together. The counters live in the process; with several instances each instance counts on its own.

## Sign-in brake per client address

The pair limit `auth:login` (client address plus e-mail) does not stop one address from trying a single password against
many accounts. The Auth module therefore offers an opt-in brake for failed sign-ins per client address (policy
`auth:login-ip`, IPv6 grouped by /64): from a threshold of failures per window the sign-in check is delayed before the
password is verified (so known and unknown accounts answer equally slowly), concurrent checks per address are capped, and
requests above the caps get 429 with `Retry-After`. Only failed passwords count; a successful sign-in neither counts nor
resets. It does not help against distributed attacks (many addresses, few attempts each), and the counters live in the
process (N instances give N times the budget).

**The image ships with the brake switched off, on purpose.** Identity honours `X-Forwarded-*` only from the
proxies you list in `ServiceHost:ReverseProxy`. Without the profile the header is ignored, every user behind the frontend shows
up with the frontend's address, and an enabled brake would throttle all sign-ins together (a global denial of service).
Neither Identity nor Auth can tell whether your topology is configured correctly (Auth only logs a start-up warning), so
the decision stays with the operator.

Activation checklist:

1. Set `ServiceHost__ReverseProxy__Enabled=true` and `ServiceHost__ReverseProxy__KnownProxies__0` (or `__KnownNetworks__0`, for example the compose network in CIDR
   notation) to the frontend or proxy that calls identity. Verify that sign-in failures from two browsers are counted
   separately before going on.
2. Disable retries of `POST /api/auth/login` in the frontend's HTTP client (a retried 429 multiplies the load).
3. Make sure the frontend's timeout for the sign-in call exceeds the brake's `MaxDelay` plus the frontend's own delay.
4. Enable it:

```
BieberWorks__Auth__SignIn__FailureBrake__Enabled=true
BieberWorks__Auth__SignIn__FailureBrake__DelayAfterFailures=10        # failures per window without delay
BieberWorks__Auth__SignIn__FailureBrake__DelayStep=00:00:00.500       # delay per failure above the threshold
BieberWorks__Auth__SignIn__FailureBrake__MaxDelay=00:00:05
BieberWorks__Auth__SignIn__FailureBrake__MaxConcurrentPerAddress=16        # cold address
BieberWorks__Auth__SignIn__FailureBrake__MaxConcurrentPerBrakedAddress=2   # braked address
BieberWorks__Auth__SignIn__FailureBrake__MaxHeldRequests=256               # delayed requests in the whole process
BieberWorks__Auth__SignIn__FailureBrake__RejectWhenSaturated=false         # true: 429 until the window ends
RateLimiting__Policies__auth-login-ip__PermitLimit=30                 # saturation point (default 30)
RateLimiting__Policies__auth-login-ip__Window=00:15:00
```

`RateLimiting__Policies__auth-login-ip__*` follows the same rules as the other policies above. The counter is a fixed
window: when it expires the address gets its free attempts back. Behind a NAT the users of one address share the brake;
keep `RejectWhenSaturated` off unless you accept that.

## Telemetry

The service can push traces, metrics and logs over OTLP (OpenTelemetry) to a collector. It is **off by default**: without
`Observability__Enabled=true` the host behaves exactly as before and no provider or exporter exists. `Observability:Enabled`
is the only switch; `OTEL_*` variables alone never turn telemetry on.

```
Observability__Enabled=true
Observability__Otlp__Endpoint=http://collector:4318          # http/protobuf; the /v1/{traces,metrics,logs} paths are appended
# Observability__Otlp__Protocol=grpc                         # optional, then use the gRPC port (4317)
# Observability__Otlp__Headers__Authorization=<from a secret> # hosted backends; never in a committed file
# Observability__Signals__Logs=false                         # switch a signal off
OTEL_TRACES_SAMPLER=parentbased_traceidratio                 # standard sampling variables apply
OTEL_TRACES_SAMPLER_ARG=0.1
```

* **Identity of the service.** `service.name` and `service.version` come from `ServiceHost:ServiceName` /
  `ServiceHost:ServiceVersion` (the image sets the version from `BW_VERSION`), so telemetry and `/info` agree.
  `service.namespace` is `bieberworks`; `deployment.environment.name` is the hosting environment or the value in `OTEL_RESOURCE_ATTRIBUTES`.
* **What is exported.** Every `BieberWorks.SDK.*` meter and activity source (ServiceKit outbox, Auth, RateLimiting), ASP.NET Core
  and `HttpClient` instrumentation, runtime metrics, Npgsql spans and metrics, health check results
  (`bieberworks.observability.health.status{check}`, Prometheus `bieberworks_observability_health_status_ratio`; checks `auth-mail-jobs` and `service-outbox`) and the logs of the host with
  `trace_id`/`span_id`. `/health`, `/alive` and `/metrics` requests create no spans.
* **One metric path.** Either OTLP push or the ServiceKit scrape endpoint (`ServiceHost:Metrics`), never both: that would
  deliver every series twice.
* **One trace per registration.** `POST /api/auth/register`, the stored mail job, `servicekit.publish` and (in the receiving
  service) the inbox request and `servicekit.handle` share one trace id. The trace context is kept in the durable mail job.
* **Health endpoints.** `/health` and `/alive` come from the ServiceKit host only. Do not add `MapBieberWorksHealthEndpoints`: the
  host would refuse to start with a message naming the doubled route.
* **Misconfiguration never stops the service.** An unknown protocol or malformed endpoint is logged as a warning and the
  affected signal stays off.

Reading the sign-in protection (Prometheus names after the OTLP translation):

| Question | Series |
| --- | --- |
| How do sign-ins end? | `bieberworks_auth_login_attempts_total{outcome}` (`success`, `invalid_credentials`, `locked_out`, `email_unconfirmed`, `two_factor`, `rate_limited`, `brake_rejected`, `error`) |
| Is the sign-in brake delaying? | `bieberworks_auth_login_brake_delay_seconds_bucket` |
| Which limit rejects requests? | `bieberworks_ratelimiting_decisions_total{policy,outcome}` (`allowed`, `rejected`, `locked_out`; `policy` is for example `auth:login`, `auth:login-ip`, `auth:register-ip`) |
| Are mails leaving? | `bieberworks_servicekit_outbox_backlog{state}`, `bieberworks_servicekit_outbox_oldest_pending_age_seconds`, `bieberworks_auth_email_send_failures_total{kind}` |
| Is the database slow? | the Npgsql command metrics and the `service-outbox` / `auth-mail-jobs` health series |

Telemetry changes of this release for dashboards and alerts: the `http_route` label and the span name of the Auth endpoints now have
a leading slash (`/api/auth/login`, not `api/auth/login`); the ServiceKit instruments are named `bieberworks.servicekit.*`
(Prometheus `bieberworks_servicekit_*`).

## Rolling back

A start against a database whose `__EFMigrationsHistory` contains migrations unknown to the image logs an error naming them
(the image was probably rolled back). Set `Database__RefuseNewerSchema=true` to stop instead. Restore a backup or run a
version at least as new as the schema. The signing key and the other secrets live outside the database and must be backed up
separately; without the signing key every issued token and refresh token is useless.

## Mail jobs after a crash

Mail jobs are leased while they are sent. After a hard kill the job is picked up again once its lease expired (2 minutes by
default, `BieberWorks:Auth:MailQueue`), so a mail can be late by that time but is not lost. Delivery is at-least-once: a crash after the communication service accepted
a mail event but before the outbox row was marked delivered, or a lease that expires during a slow delivery, sends the event
again. The communication service deduplicates by the message id (the job id), so a repeat is ignored while the id is still
in its inbox (`InboxRetention`, 30 days); the Auth job and the outbox event share that id, so a mail is not queued twice at
submission.

## Container

* Memory: give the container a limit (for example `mem_limit: 512m`); the process settles around 150 to 200 MiB.
* Logs: the service writes to the console; limit the log size in the runtime (see the logging section of the configuration page).
* Exposure: `/info` and `/openapi/v1.json` are anonymous by default. Keep the service on an internal network, or set
  `ServiceHost__InfoRequiresAuthorization=true` and `OpenApi__RequireAuthorization=true`.
* Signing key rotation: see the ServiceKit operations guide.
* A failed start (invalid configuration, unreachable or missing database, failed validation), like any other unhandled
  exception, ends with **exit code 1** and
  the line `identity: terminated by an unhandled exception: <exception>` on stderr, followed by the stack trace; connection passwords are not part of
  it. Images up to `0.1.0-rc.0` ended such a start with exit code 139: the unhandled exception made the .NET runtime call
  `abort()`, and a process running as PID 1 has no default action for `SIGABRT`, so the C library falls back to a privileged
  instruction (`hlt` on x86-64), which the kernel answers with `SIGSEGV` (139). It was not a memory fault. The same runtime outside PID 1 ends with
  134; the minimal reproduction (`throw` in `Main`, same base image) gives 139 as PID 1, 134 under `bash` or `docker run --init`.
* Run the container with an init process (`init: true` in Compose, `docker run --init`) anyway: any other fatal runtime
  error then ends with its real signal (134 instead of 139), and signals and zombie processes are handled as usual.

