# Usage

## Publishing an event

Business code never calls a publisher. It queues the event, ideally in the same transaction as its data:

```csharp
await enqueuer.EnqueueAsync("identity.email-confirmation-requested", new { userId, email });
```

A producer that can run twice for the same logical event (a retried job, for example) passes a stable `messageId`.
The outbox ignores a second append with the same id, so the event is published once:

```csharp
await enqueuer.EnqueueAsync("email.mail-requested", payload, messageId: jobId);
```

`ServiceOutboxRelay` (hosted service) reads due entries and calls the configured `IServiceEventPublisher`.
Failures are classified:

- **Transient** (subscriber unreachable, timeout, HTTP 5xx, 408, 429): retried with exponential backoff (`BaseBackoff`,
  doubling, capped by `MaxBackoff`, default 10 min). The entry is dead-lettered only when the time budget `MaxRetryAge`
  (default 3 days, counted from enqueue; `0` = never) is spent, or after `MaxAttempts` if you set a limit (default `0` = none).
- **Configuration problem** (subscriber address missing, HTTP 401/403/404): the entry stays pending, is looked at again
  with a growing pause (`DeferredRetryDelay` up to `MaxBackoff`), never counts toward any limit and `/health` reports
  `Degraded` (count and age of the oldest waiting entry). Only the first deferral is logged as a warning.
- **Poison** (HTTP 400/413/422 from the subscriber): dead-lettered at once.

A receiver outage therefore never blocks the publishing request and loses no event; delivery resumes when the receiver is back.

Dead letters can be re-queued after the cause is fixed: `PostgresServiceOutbox.RequeueDeadLettersAsync()` (resolve the
class from DI), or `UPDATE <schema>.service_outbox SET state='pending', attempts=0, budget_started_at=now(), next_attempt_at=to_timestamp(0) WHERE state='dead'`.
A re-queue restarts the retry time budget (`MaxRetryAge`) through the column `budget_started_at`, so an old event survives
transient errors again; `created_at` stays untouched and keeps the first-in-first-out order. Existing tables get the column
automatically (additive, `NULL` falls back to `created_at`). Receivers deduplicate by message id, so a re-queued event is processed once.

## Receiving an event

Implement `IServiceEventHandler` (one event type each) and register it with `AddServiceEventHandler<T>()`.
The dispatcher records the `MessageId` in the `IServiceInbox` after all handlers succeeded, so a redelivered message
is acknowledged without running the handlers again. Handling is serialized per message id (a lock in the inbox; a
PostgreSQL advisory lock for the persistent store), so two concurrent deliveries of one event run the handlers once.
A handler exception answers HTTP 500 and the sender retries. A handler that finds the event can never be processed
(undecodable payload) throws `PermanentEventException` (a `JsonException` counts too): the host answers 422 and the
sender dead-letters the event at once. An event type without a handler is answered 422 as well, so it is dead-lettered
visibly instead of being lost; set `ServiceHost:IgnoreUnknownEventTypes=true` to acknowledge (202) it with a warning and the
`servicekit.events.unhandled` metric instead (rolling upgrades with mixed event versions).
The host itself answers 422 before any handler runs when the envelope's `payload` is missing, empty or not a JSON
document. A payload that is valid JSON but unusable for the handler (for example `{}`) is the handler's decision: it must
throw `PermanentEventException` for content that can never succeed (validation errors), and let only transient faults
escape as other exceptions, or the sender retries a poison event until its retry budget is spent.

## Guarantees (all transports)

- At least once; no ordering between events; redelivery on failure; dead-letter after N attempts.
- The idempotency inbox sits above the transport. Handlers must still be idempotent in effect.
- One transport per deployment (`ServiceTransport:Mode`); mixed operation is not supported.
- A receiver without a handler for an event type acknowledges and ignores it (logged as a warning).

## Token validation

The host validates access tokens against the public keys published by the identity service
(`ServiceHost:Jwt`). It never holds a signing secret. Only the configured asymmetric algorithms are accepted
(default `ES256`, `RS256`); HMAC tokens and `alg=none` are rejected, and the audience must equal the service name.

## Forwarding the user token (BFF)

`ServiceTokenHolder` stores the token in an `AsyncLocal`, because `IHttpClientFactory` builds handlers in its own DI
scope and a Blazor circuit has no `HttpContext`. Call `holder.Set(token)` (or `holder.BeginScope(token)` inside a
circuit activity handler) before calling services; `AddServiceHttpClient` attaches it as bearer token.
Service-to-service calls without a user use `IServiceTokenSource` (implemented by the identity integration).
