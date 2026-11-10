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
`Identity:ForwardedHeaders:KnownProxies` / `KnownNetworks`. Without that, a limit such as registration blocks all users behind
the proxy together. The counters live in the process; with several instances each instance counts on its own.

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

