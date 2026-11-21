# User events

The identity service publishes what happens to user accounts as service events, so other services can keep a projection of the users they need and delete their own data when an account is deleted (GDPR Art. 17). The event names and the payload schema below are a **stable contract**.

| Event type | When | Payload (schema version 1) |
| --- | --- | --- |
| `identity.user-created` | An account was created (registration, bootstrap seed, any other writer) | `userId`, `occurredAt`, `revision`, `source`, `profile` |
| `identity.user-updated` | A relevant field of an account changed | `userId`, `occurredAt`, `revision`, `changes`, `profile` |
| `identity.user-deleted` | An account was deleted | `userId`, `occurredAt`, `revision`, `mode`, `initiator` |

The payload is JSON with web naming (camel case). The contract types are in `BieberWorks.SDK.Auth.Contracts.Lifecycle` (`IdentityUserServiceEvents` for the names, `UserCreatedPayload`, `UserUpdatedPayload`, `UserDeletedPayload`, `UserLifecycleProfile`).

| Field | Meaning |
| --- | --- |
| `userId` | Id of the account. |
| `occurredAt` | When the change was captured (UTC). |
| `revision` | UTC ticks of the capture. Rises with every change of a user **as long as the clocks of all identity instances are synchronized** (see below); it is not a logical counter. |
| `source` | How the account was created: `registration`, `seed`, `admin` or `unknown`. |
| `changes` | Which categories changed: `email`, `email-confirmed`, `user-name`, `display-name`, `name`, `culture`, `locked`, `roles`. Categories only, never values. |
| `profile` | The **current state**, not a diff: `userName`, `displayName`, `emailConfirmed`, `locked`, `culture`. `email` is present only with `Identity:UserEvents:IncludeEmail`. |
| `mode` | `hard-delete` or `anonymize`: what happens to the data in other modules. |
| `initiator` | `self`, `admin` or `system`. |

## What is never in an event

First and last name, role names, password or two-factor data, security stamps, the acting user's id, IP addresses. The e-mail address is **off by default**; set `Identity:UserEvents:IncludeEmail` to `true` only for receivers that need it.

## Delivery

* **Subscribe** in the configuration of the identity service, per event type: `ServiceTransport:Subscriptions:identity.user-created: [ "billing" ]` (the subscriber also needs an entry in `ServiceEndpoints:Services`). An event without a subscriber is accepted and removed by the outbox retention.
* **At least once, no ordering.** Retries, backoff, dead-letter, health and metrics are those of the service transport (`bieberworks.servicekit.*` counts these events with `event_type=identity.user-*`).
* **No lost events.** A change of a user and its event are written in one database transaction (the Auth outbox). A background dispatcher then queues it in the persistent service outbox under a stable message id, so a crash or an outage at any point delays an event but does not lose it.
* **No events for existing users.** Turning the feature on does not replay accounts that already exist. A receiver that needs them must fetch them another way.
* Not captured: changes that bypass the Auth database context (`ExecuteUpdate`, `ExecuteDelete`, raw SQL, direct SQL). Time-based lock expiry produces no event.
* The service events are not part of the trace of the request that caused them: the dispatcher runs in the background and starts a new trace per event.

## Rules for receivers

1. **Deduplicate on the message id** of the envelope (the service transport's inbox does this for you).
2. **Be idempotent.** Applying the same event twice must change nothing.
3. **Use `revision`.** Drop an update with a smaller `revision` than the one you already hold for that `userId`; deliveries are not ordered.
4. **A deleted event is a tombstone.** Delete your data for the `userId` and ignore every later `identity.user-updated` and `identity.user-created` for it.
5. **Ignore unknown fields.** New fields are added to an event type without a new name.
6. Do not treat `profile.locked` as a live value: it is the state when the event was captured.

## Versioning

Within one event type only additive changes happen, and the `schemaVersion` of the envelope rises. A breaking change gets a **new event name** (for example `identity.user-updated.v2`) that is published in parallel with the old one for at least one release. Receivers that roll out earlier than the publisher can set `ServiceHost:IgnoreUnknownEventTypes`.

## Configuration

| Key | Default | Meaning |
| --- | --- | --- |
| `Identity:UserEvents:Enabled` | `true` | Capture user changes and publish the events. Off: nothing is captured, nothing queued. |
| `Identity:UserEvents:IncludeEmail` | `false` | Put the e-mail address into `profile`. |
| `BieberWorks:Auth:LifecycleEvents:*` | derived | Polling, backoff (`BaseRetryDelay` 5 s, `MaxRetryDelay` 5 min, `MaxAttempts` 300) and retention (`RetentionPeriod` 3 days, `DeadLetterRetentionPeriod` 30 days) of the Auth outbox, see the Auth documentation (User Lifecycle Events). `Enabled` and `IncludeEmail` follow `Identity:UserEvents` unless set explicitly. |
| `ServiceTransport:Postgres:DeadRetention` | `30.00:00:00` | How long dead-lettered entries of the service outbox keep their payload. The identity service sets 30 days (the transport's own default is 90) unless configured. |

See [operations](50-operations.md#user-events) for retention and dead-letters.

## Limits of the guarantees

* **Clocks.** `revision` is taken from the clock of the instance that writes the change. With several identity instances whose clocks drift, a later change can get a smaller `revision`. Run NTP (or equivalent) on all instances; receivers must treat `revision` as "latest wins", not as a gap-free sequence.
* **Duplicates.** The Auth outbox dispatcher claims rows with a lease inside a transaction (`FOR UPDATE SKIP LOCKED`, since SDK-Persistence 2.0), so several identity instances do not pick up the same row at the same time. Delivery is still **at least once**: a crash or a lost lease after the hand-over, or a hand-over that outlives the lease (5 minutes), lets another round deliver the row again. The message id is stable (it is the event id), and the service outbox and the receiver's inbox deduplicate on it. Receivers still have to be **idempotent** and order by `revision`, never by arrival.
* **Retries.** A failed hand-over to the service outbox is retried with exponential backoff: 5 seconds after the first failure, doubling up to 5 minutes (`BieberWorks:Auth:LifecycleEvents:BaseRetryDelay`, `MaxRetryDelay`). A row in backoff does not hold back later rows, which is one more reason deliveries are not ordered.
* **Dead-lettered events.** After `BieberWorks:Auth:LifecycleEvents:MaxAttempts` (default 300, about **24.5 hours** of a failing hand-over with the default backoff) the Auth dispatcher gives up on a row, logs an `Error` (event id 5004, "dead-lettered") and counts it in `bieberworks.persistence.outbox.dead_lettered` (tag `context=AuthDbContext`). Both are alarm signals; a lost `identity.user-deleted` means a receiver keeps personal data. Dead-lettered rows are deleted after `DeadLetterRetentionPeriod` (default 30 days, the same as the identity service's default for dead-lettered service outbox entries), so re-queue them before that (see [operations](50-operations.md#user-events)).
* **One outbox store per database context.** The identity host runs several modules that register outbox stores (Auth, Oidc through its database registration) next to the ServiceKit service outbox. Since SDK-Persistence 2.1 the Auth dispatcher resolves the store of `AuthDbContext` only, so another module cannot redirect it to a foreign table; the ServiceKit service outbox is a separate store and is not affected.
