# Operations

See also the ServiceKit operations guide (database outage behaviour, metrics, tracing, signing key rotation, `/info`
exposure); the settings below are specific to the communication image.

## Health: mail server and queue

`/health` contains a `mail-queue` check that reads the queue in the background (every 15 s), so `/health` never waits for
the database for it. It reports **Degraded** (HTTP 200, never Unhealthy) when

* mails are retrying (a delivery was attempted and failed): the mail server is unreachable, rejects the sender or the
  credentials are wrong;
* the oldest waiting mail is older than `Communication:Health:PendingDegradedAfter` (10 minutes);
* at least `BacklogDegradedAt` (1000) mails wait;
* mails gave up after all attempts within `FailedLookback` (24 hours).

The `/health` JSON shows only the status and a short description of the problem (no numbers); the counts are in the metrics
below. The check data (counts and the category of the last failure, an exception type name such as `SmtpCommandException`)
is available to in-process consumers only, and never contains a connection string, address or mail content. The check
reads a snapshot that is refreshed in the background, and it only reflects the queue: without waiting mails a mail server
outage stays unnoticed until the next mail is sent. Without a fresh reading (database unreachable) the check is Degraded too.
Metrics when enabled: `communication_mail_queue_messages{state="pending|retrying|failed"}` and
`communication_mail_queue_oldest_pending_age_seconds`.

The sending service (identity) shows a failed delivery to communication as a dead letter in its own `service-outbox` check.

## Database outage

Connections time out after 3 s and commands after 10 s (`Database:*`), failed calls are retried once. A request that cannot
reach the database (mail submission, the event inbox) is answered **503 with `Retry-After`**
(`ServiceHost:DependencyRetryAfter`, 5 s), and `/health` answers `Unhealthy` within 1.5 s. The senders keep their events
and deliver them when the service is back. `/alive` stays 200, which the image `HEALTHCHECK` uses. In the `Development`
environment the developer exception page answers first.

From the ServiceKit version after `0.1.0-rc.0` on, a **fail-fast circuit** per database server (`ServiceTransport:Circuit`,
break 5 s) also covers the Email module's database context, without configuration: the first request that meets the outage
waits for one connect timeout (measured 3.1 s), every further one is refused within milliseconds (measured 0.01 s) and
`/health` reports the outage at once, even while its cached numbers (`ServiceTransport:Postgres:HealthCacheDuration`,
5 s) are still fresh. After the break one request probes the database; recovery needs no restart. With the pinned
`0.1.0-rc.0` every submission waits for its own connect timeouts and the retry (measured 6.1 s with a hanging database, up to
10.6 s in the RC2 acceptance). See the ServiceKit operations guide for the details.

A 503 is not proof that nothing happened. A submission refused by the open circuit before any database call has
`outcomeUnknown: false` and changed nothing. A write that timed out or lost its connection may have been committed (the body
then has `outcomeUnknown: true`). Repeating a submission with the same `messageId` is safe in both cases (the second PUT is a
no-op); a submission without an id may queue the mail twice.

## Start-up checks

* An empty `ServiceHost__Jwt__Authority` stops a Production start: the service would otherwise run and reject every token.
* A database whose `__EFMigrationsHistory` contains migrations unknown to the image logs an error naming them (rolled back
  image). `Database__RefuseNewerSchema=true` stops instead.
* A failed start (invalid configuration, unreachable or missing database, failed validation), like any other unhandled
  exception, ends with **exit code 1** and
  the line `communication: terminated by an unhandled exception: <exception>` on stderr, followed by the stack trace; connection passwords are not part of
  it. Images up to `0.1.0-rc.0` ended such a start with exit code 139: the unhandled exception made the .NET runtime call
  `abort()`, and a process running as PID 1 has no default action for `SIGABRT`, so the C library falls back to a privileged
  instruction (`hlt` on x86-64), which the kernel answers with `SIGSEGV` (139). It was not a memory fault. The same runtime outside PID 1 ends with
  134; the minimal reproduction (`throw` in `Main`, same base image) gives 139 as PID 1, 134 under `bash` or `docker run --init`.
* Run the container with an init process (`init: true` in Compose, `docker run --init`) anyway: any other fatal runtime
  error then ends with its real signal (134 instead of 139), and signals and zombie processes are handled as usual.

## Mail after a crash

A claimed queue message is protected for `Email:Queue:LeaseDuration` (5 minutes by default). After a hard kill it is sent
again once the lease expired, so a mail can be late by up to that time but is not lost. Delivery is at-least-once, not exactly-once: a crash after the
mail server accepted a mail but before the status update, or a lease that expires during a slow send, sends that mail a
second time (the recipient may see a duplicate). Submission is idempotent: the same `messageId` (queued sending API and
event inbox) never queues a second mail, and a repeated event is dropped by the inbox. Lower the lease only
if a single send never takes that long. Transport events from identity are picked up after
`ServiceTransport:Postgres:LeaseDuration` (60 s).

## Container

* Memory: give the container a limit (for example `mem_limit: 512m`); the process settles around 150 to 200 MiB.
* Logs: the service writes to the console; limit the log size in the runtime (see the logging section of the configuration page).
* Exposure: `/info` and `/openapi/v1.json` are anonymous by default. Keep the service on an internal network, or set
  `ServiceHost__InfoRequiresAuthorization=true` and `OpenApi__RequireAuthorization=true`.
* Production sends mail only over TLS unless `Email__AllowInsecureTransport=true` is set (test setups with Mailpit).
