# Persistent outbox and inbox (PostgreSQL)

The in-memory stores of `ServiceKit.Transport` lose events when the process stops. Production services register the
PostgreSQL stores instead:

```csharp
builder.Services.AddBieberWorksServiceHost(builder.Configuration);   // registers the in-memory stores
builder.Services.AddServiceKitHttpTransport();
builder.Services.AddServiceKitPostgresStores(connectionString);      // replaces them
builder.Services.AddServiceKitOutboxRelay();
```

Tables `service_outbox` and `service_inbox` are created on first use in the schema `servicekit` (configurable through
`ServiceTransport:Postgres:Schema`; lower-case letters, digits, underscore). Creation is guarded by an advisory lock, so
several instances may start together. Use the service's own database or its own schema; never share the tables between
services.

## Behaviour

* **Outbox:** `AppendAsync` is idempotent on the message id. `GetDueAsync` claims entries with
  `FOR UPDATE SKIP LOCKED` and a lease (`LeaseDuration`, default 60 s), so several relays never deliver the same entry
  at the same time. If a relay dies, the lease expires and the entry is delivered by another relay. Delivery is
  at-least-once.
* **Delivery guarantee:** at-least-once, never exactly-once. A crash after the receiver accepted an event but before the
  outbox row was marked delivered, or a lease that expires during a slow delivery, sends the event a second time. Late
  state changes are harmless: a mark only applies in the expected state, so a late dead letter never overwrites a
  delivered entry, and a dead letter whose payload was emptied is not re-queued. Idempotency at submission time comes from
  the `messageId`; at delivery time the receiver's inbox deduplicates.
* **Inbox:** processed message ids are stored persistently. The dispatcher checks the inbox before it calls the
  handlers and records the id after they succeeded. A crash between the two steps leads to one more handler call, so
  handlers must still be idempotent in effect (for example by using the message id as their own idempotency key).
* **Health:** the check `service-outbox` makes `/health` report `Degraded` when dead letters exist, when a waiting entry
  has a failed or deferred attempt (for example a missing or unreachable subscriber address), or when an entry waits
  longer than `DegradedAfterPendingFor` (default 5 minutes), and `Unhealthy` when the database is unreachable.

## Payload clearing and retention

* **Payload clearing:** when an entry is marked delivered, its payload is replaced by `{}` at once. Event payloads can
  carry personal data or secrets (for example the finished mail with confirmation links); they must not stay in the
  table after delivery. The message id remains, so idempotency is unaffected.
* **Retention sweeper:** a hosted service (`PostgresTransportRetentionService`, registered by
  `AddServiceKitPostgresStores`) removes old rows in batches. Options in `ServiceTransport:Postgres`:

| Option | Default | Meaning |
| --- | --- | --- |
| `RetentionEnabled` | `true` | Switch the sweeper off to keep all rows. |
| `SweepInterval` | 1 h | How often it runs. |
| `DeliveredRetention` | 7 days | Delivered outbox rows (payload already empty) are deleted after this time. |
| `InboxRetention` | 30 days | Processed ids are deleted after this time. Keep it well above `MaxRetryAge` (3 days), otherwise a late redelivery runs its handler again. |
| `DeadRetention` | 90 days | Dead-lettered rows are deleted this long after their retry budget started; a warning is logged. Until then they can be requeued and keep `/health` Degraded. |
| `SweepBatchSize` | 1000 | Rows per delete statement. |

A value of zero (or less) for a retention keeps the rows of that kind. Pending and deferred entries are never swept.

## Timeouts and metrics

`ServiceTransport:Postgres:ConnectTimeout` (3 s) and `CommandTimeout` (10 s) are added to the connection string unless it sets
`Timeout` / `Command Timeout` itself, so a database outage fails fast. `MetricsInterval` (15 s) refreshes the backlog gauges
(see [operations](50-operations.md)).
