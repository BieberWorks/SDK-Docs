# Telemetry and queue statistics

The queue (see [Queued sending API](13-queued-sending-api.md)) publishes metrics and spans with plain .NET types
(`System.Diagnostics.Metrics`, `System.Diagnostics.ActivitySource`). The module has no dependency on OpenTelemetry or on
the Observability module: any host that listens to `BieberWorks.SDK.Email` (for example through `BieberWorks.SDK.Observability`) receives them.
Names follow the SDK telemetry naming convention.

## Instruments (meter `BieberWorks.SDK.Email`)

| Instrument | Type, unit | Tags | Meaning |
|---|---|---|---|
| `bieberworks.email.deliveries` | counter, `{delivery}` | `result` = `sent`, `retry`, `failed` | Delivery attempts. `retry`: the attempt failed and another one is scheduled; `failed`: the message gave up after `MaxAttempts`. |
| `bieberworks.email.send.duration` | histogram, `s` | `result` = `sent`, `retry`, `failed` | Time to hand one message to the mail server. Buckets: 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60. |
| `bieberworks.email.queue.messages` | gauge, `{message}` | `state` = `pending`, `retrying`, `failed_recent` | Queue content. The states are disjoint (see below). |
| `bieberworks.email.queue.oldest_pending_age` | gauge, `s` | none | Age of the oldest message still waiting (`pending` or `retrying`); 0 when nothing waits. |

Recipients, subjects and message ids are never tag values. In Prometheus the names read
`bieberworks_email_deliveries_total`, `bieberworks_email_send_duration_seconds_bucket`, `bieberworks_email_queue_messages` and
`bieberworks_email_queue_oldest_pending_age_seconds`.

The delivery counter and duration cover the queue dispatcher. Mails sent directly through `IEmailSender` (queue disabled) are not counted.

The gauges are fed by a background refresher (`Email:Queue:StatisticsInterval`, default 15 seconds; failed mails count for
`Email:Queue:StatisticsFailedLookback`, default 24 hours) and only exist when `Email:Queue:Enabled` is true. A scrape never queries
the database; the age is computed from the submission time at scrape time, so it keeps growing between refreshes.

## Tracing

Activity source `BieberWorks.SDK.Email`, span `email.send` (kind `Client`, tags `email.attempt`, `result`, `error.type` on failure).
When a message is queued, the W3C `traceparent` of the current activity is stored in the new nullable column
`email.queue_messages.trace_parent` (migration `AddQueueTraceParent`, additive; older rows have no value). The dispatcher
starts `email.send` as a child of that context, so a request or event that queues a mail, and the delivery, share one trace and
the delivery's log lines carry its `trace_id`. The submission API is unchanged.

## Queue statistics contract

`IEmailQueueStatistics` (in `Email.Contracts`, always registered by the module) returns an `EmailQueueSnapshot`:

| Field | Meaning |
|---|---|
| `Pending` | Waiting for the first attempt (no failed attempt yet) |
| `Retrying` | Waiting after at least one failed attempt |
| `FailedRecent` | Gave up within the `failedLookback` argument (zero or less: none counted) |
| `OldestPendingCreatedAt` / `OldestPendingAge` | Submission time and age of the oldest waiting message (pending or retrying) |
| `LastErrorCategory` | Exception type name of the latest failure, never an address or content |
| `CapturedAt` | Time of the reading |

A message is counted in at most one of `Pending`, `Retrying` and `FailedRecent`. A host that needs "everything waiting" adds
`Pending + Retrying`. Hosts and health checks use this contract instead of querying the `email` schema themselves.
