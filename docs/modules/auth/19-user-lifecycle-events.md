# User Lifecycle Events

The Auth module can report the creation, change and deletion of users as events. Other services use them to keep a projection of the users they need, and to delete their own data when an account is deleted (GDPR Art. 17). The feature is **off by default**.

Two things are involved:

- **In the Auth module (this page):** every relevant change of the user table is written to an outbox table in the `auth` schema, in the **same transaction** as the change. A background dispatcher publishes it in-process afterwards as a domain event. A crash between the commit and the publish loses nothing.
- **In a service host:** a host picks the domain events up and forwards them, for example to other services. The identity service does this and publishes the service events `identity.user-created`, `identity.user-updated` and `identity.user-deleted` (see the documentation of the identity service).

## Turning it on

```json
{
  "BieberWorks": {
    "Auth": {
      "LifecycleEvents": {
        "Enabled": true,
        "IncludeEmail": false,
        "PollInterval": "00:00:05",
        "BatchSize": 50,
        "MaxAttempts": 300,
        "BaseRetryDelay": "00:00:05",
        "MaxRetryDelay": "00:05:00",
        "RetentionPeriod": "3.00:00:00",
        "DeadLetterRetentionPeriod": "30.00:00:00"
      }
    }
  }
}
```

| Option | Default | Meaning |
|---|---|---|
| `Enabled` | `false` | Capture and dispatch. When off, no interceptor and no background service exist. The outbox table is created by the migration either way. |
| `IncludeEmail` | `false` | Puts the e-mail address into the event profile, and so into the outbox row. Off because most receivers do not need personal data they could not justify. |
| `PollInterval` | 5 s | Pause between two polls of the outbox. |
| `BatchSize` | 50 | Messages per poll. |
| `MaxAttempts` | 300 | Publish attempts before a message is dead-lettered. With the default backoff the window is about 24.5 hours of failing downstream (important for the delete tombstone). |
| `BaseRetryDelay` | 5 s | Delay before the first retry; it doubles with every further failure (`BaseRetryDelay * 2^(n-1)`). `00:00:00` turns the backoff off (retry on every poll). Must not be negative. |
| `MaxRetryDelay` | 5 min | Upper bound of the retry delay. At least `BaseRetryDelay`, at most 1 day: the cap bounds how long a recovered downstream may still wait for a message such as the delete tombstone. |
| `RetentionPeriod` | 3 days | How long **processed** rows stay (they hold the profile snapshot). At most 30 days; the start fails otherwise. |
| `DeadLetterRetentionPeriod` | 30 days | How long **dead-lettered** rows stay for inspection or replay. At most 90 days. Dead-lettered rows carry the profile snapshot (with `IncludeEmail` also the e-mail address), possibly of an already deleted user, so the cap is a GDPR trade-off between the replay window and data minimisation. |

The values are validated at start, and only while the feature is enabled. The outbox of the persistence package validates the resulting dispatcher options at start as well. All time-based values are effectively rounded up to the next `PollInterval`.

### Retry window

A failed publish is retried after 5 s, 10 s, 20 s, 40 s, 80 s, 160 s and then every 5 minutes. A message is dead-lettered after `MaxAttempts` attempts:

| `MaxAttempts` | Window before dead-letter (default delays) |
|---|---|
| 10 | about 20 minutes |
| 50 | about 3.7 hours |
| 300 (default) | about 24.5 hours |
| 600 | about 49.5 hours |

The attempt count is stored when the dispatcher claims a message, so a crash or hang during the publish counts as an attempt too. A claimed message is invisible to other dispatchers for the lease of the persistence outbox (5 minutes), so several host instances do not deliver the same row at the same time. A graceful shutdown during a publish costs no attempt; the message is retried after the lease.

::: warning Migration
Version 4.6.0 adds the migration `AddUserLifecycleOutbox`: one new table `auth.outbox_messages` with two indexes. It is additive and applied by the module at start, also for hosts that keep the feature off.
:::

::: warning Upgrading to 4.7.0
Version 4.7.0 references `BieberWorks.SDK.Persistence` 2.x and adds the migration `AddOutboxNextAttemptOnUtc`: one nullable column `NextAttemptOnUtc` in `auth.outbox_messages` (retry time and claim lease). It is additive; existing pending rows are due immediately. The persistence 2.x outbox model changes for **every** module that maps the outbox, so update Auth, Jobs and Webhooks together: an older module with Persistence 2.x fails the host start with pending model changes. The default `MaxAttempts` rose from 120 to 300, and dead-lettered rows now have their own retention (`DeadLetterRetentionPeriod`, 30 days).
:::

## Events

The domain events live in `BieberWorks.SDK.Auth.Contracts.Lifecycle`, so a monolith host can handle them with an `IDomainEventProcessor<T>` directly.

| Event | Outbox discriminator | Carries |
|---|---|---|
| `UserCreatedLifecycleEvent` | `auth.user-created.v1` | `EventId`, `UserId`, `OccurredAt`, `Revision`, `Source`, `Profile` |
| `UserUpdatedLifecycleEvent` | `auth.user-updated.v1` | `EventId`, `UserId`, `OccurredAt`, `Revision`, `Changes`, `Profile` |
| `UserDeletedLifecycleEvent` | `auth.user-deleted.v1` | `EventId`, `UserId`, `OccurredAt`, `Revision`, `Mode`, `Initiator` |

- `EventId` is created when the change is captured and is also the id of the outbox row. A redelivery carries the same id, so a receiver (or a forwarding host) deduplicates on it.
- `Revision` is the UTC tick count of the capture. A receiver drops an update with a smaller revision than the one it holds.
- `Profile` is the **current state**, not a diff: `UserName`, `DisplayName`, `EmailConfirmed`, `Locked`, `Culture` and, only with `IncludeEmail`, `Email`. Applying it is idempotent and independent of the order of delivery.
- A deleted event is a **tombstone**. It has no profile; an update for the same user that arrives after it is to be ignored.
- The events deliberately do not implement `IAuditableEvent`. The semantic events (`UserRegisteredEvent`, `UserLockStateChangedEvent`, `UserRolesChangedEvent`, ...) are audited already; auditing these as well would record every operation twice.

### What counts as a change

Only the fields below cause an `updated` event. Everything else (`LastLoginAt`, security stamp, concurrency stamp, failed-access counter, password hash, two-factor fields) never does, so a sign-in or a password change writes nothing.

| `Changes` category | Fields |
|---|---|
| `email` | e-mail address |
| `email-confirmed` | confirmation flag |
| `user-name` | user name |
| `display-name` | display name |
| `name` | first or last name (the names themselves are never in an event) |
| `culture` | preferred culture |
| `locked` | the account became locked or unlocked |
| `roles` | a role assignment was added or removed (the roles themselves are never in an event) |

Several changes saved together are **one** event with all their categories, in the order of the table. A value that is saved but equals the old one is no change.

`Source` of a created event: `registration`, `seed` (the bootstrap admin), `admin` or `unknown` (any other writer). `Mode` of a deleted event is `hard-delete` or `anonymize`; `Initiator` is `self`, `admin` or `system`. Actor ids are never part of an event.

### Data minimisation

Names, roles, credentials, two-factor and security fields, actor ids and IP addresses never appear in an event. The e-mail address appears only with `IncludeEmail`. Log lines of the capture contain counts only, never ids or payloads.

## Delivery and limits

- **Atomic:** the outbox rows are staged by a `SaveChangesInterceptor` in the same `SaveChanges` call as the change. Whatever path changes users through the `AuthDbContext` is covered: registration, administration, self-service, confirmation, culture, lock. A save that fails or rolls back leaves no message behind.
- **At least once:** the dispatcher publishes, then marks the row processed. If marking fails, the event is published again with the same `EventId`. Handlers must be idempotent.
- **Not captured:** `ExecuteUpdate`, `ExecuteDelete`, raw SQL, changes made directly in the database, and changes to an entity that is attached with `Update()` without ever having been loaded (the original values are unknown, so no difference can be found).
- **Lock expiry:** a lock that merely runs out emits no event. `Locked` in a profile is the state at the time of the event.
- **No replay:** existing users produce no `created` event when the feature is turned on. A receiver that needs the existing users needs another way to get them.
- **Order:** events are published in the order of the changes, but a forwarding transport gives no ordering guarantee. Use `Revision`.

### Retention and personal data

Processed rows are removed after `RetentionPeriod`, dead-lettered rows after `DeadLetterRetentionPeriod` (both counted from `ProcessedOnUtc`, which the dispatcher also sets when it dead-letters). Keep both short: the rows hold the profile snapshot.

A dead-lettered row means an event, possibly a delete tombstone, was not delivered. Two signals report it:

- the log entry of the outbox dispatcher at `Error` level, event id **5004** (`Outbox message {MessageId} ({EventType}, enqueued {OccurredOnUtc}) dead-lettered after {AttemptCount} attempts for context AuthDbContext.`), without payload;
- the counter `bieberworks.persistence.outbox.dead_lettered` of the meter `BieberWorks.SDK.Persistence`, tag `context` = `AuthDbContext`. The observability module collects it through its `BieberWorks.SDK.*` meter wildcard.

Alert on either and re-queue or replay within `DeadLetterRetentionPeriod` (`auth.outbox_messages` with `Status = 2`), after that the row and its payload are gone. Every failed attempt before that is logged at `Warning` level (event id 5003) with the time of the next attempt.

To re-queue dead-lettered rows, resetting `Status` alone is not enough: each claim increments `AttemptCount`, so a row that still holds `MaxAttempts` reaches `MaxAttempts + 1` on the next claim and is dead-lettered again immediately. Reset the attempt state as well:

```sql
UPDATE auth.outbox_messages
SET "Status" = 0, "AttemptCount" = 0, "NextAttemptOnUtc" = NULL, "ProcessedOnUtc" = NULL
WHERE "Status" = 2;
```

`Status` 0 is pending, `NextAttemptOnUtc = NULL` makes the row due immediately, and clearing `ProcessedOnUtc` removes the row from the dead-letter retention cleanup. Fix the cause of the failure first (see `LastError`), and narrow the `WHERE` clause if only some rows should be replayed.

### One outbox dispatcher per host database context

Every module that maps an outbox gets its own store: the persistence package (2.1 and later) registers `IOutboxStore<TContext>` per database context, and `OutboxDispatcher<TContext>` resolves only the store of its own context. Auth registers `IOutboxStore<AuthDbContext>` (through `AddBieberWorksEfOutboxStore<AuthDbContext>()`) when the lifecycle events are on, so other modules in the same host (Oidc, Webhooks, Jobs, ...) cannot redirect the Auth dispatcher to their outbox table, whatever the module order, and the Auth dispatcher never claims their rows. Each dispatcher keeps its own options: the Auth values above (`MaxAttempts`, backoff, retention) apply to `auth.outbox_messages` only.

Auth therefore needs `BieberWorks.SDK.Persistence` and `BieberWorks.SDK.Persistence.Postgres` 2.1.0 or later. This floor is not a declared guarantee: Auth references the packages with the SDK range `2.*-*`, and 2.1.0 is the version that range resolved to when Auth was packed. Make sure your host resolves 2.1.0 or later. Up to 4.7.0 Auth worked around a single, last-registered-wins `IOutboxStore` with its own scope factory; that workaround is gone.

## Writing a handler

```csharp
services.AddScoped<IDomainEventProcessor<UserDeletedLifecycleEvent>, ErasePersonalDataOnUserDeleted>();
```

The handler runs inside the dispatcher's scope. If it throws, the message is retried with backoff and, after `MaxAttempts`, dead-lettered.
