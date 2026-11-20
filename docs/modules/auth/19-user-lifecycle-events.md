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
        "MaxAttempts": 120,
        "RetentionPeriod": "3.00:00:00"
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
| `MaxAttempts` | 120 | Publish attempts before a message is dead-lettered. The dispatcher retries on every poll without backoff, so the default tolerates about ten minutes of failing downstream (important for the delete tombstone). |
| `RetentionPeriod` | 3 days | How long **processed** rows stay (they hold the profile snapshot). At most 30 days; the start fails otherwise. |

The values are validated at start, and only while the feature is enabled.

::: warning Migration
Version 4.6.0 adds the migration `AddUserLifecycleOutbox`: one new table `auth.outbox_messages` with two indexes. It is additive and applied by the module at start, also for hosts that keep the feature off.
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

Processed **and dead-lettered** rows are removed after `RetentionPeriod` (counted from `ProcessedOnUtc`, which the dispatcher also sets when it dead-letters). Keep it short: the rows hold the profile snapshot. A dead-lettered row means an event, possibly a delete tombstone, was not delivered. The dispatcher logs this at `Error` level (event id 5004, `Outbox message ... dead-lettered`): alert on it and re-queue or replay within `RetentionPeriod` (`auth.outbox_messages` with `Status = 2`), after that the row and its payload are gone.

### One outbox dispatcher per host database context

The shared `IOutboxStore` service of the persistence package is a single registration that every module registering its database through `AddBieberWorksNpgsql` overrides, in a module order that is not defined. Auth therefore starts its dispatcher with a scope factory that always hands out the store of the `AuthDbContext`; other modules in the same host are not affected.

## Writing a handler

```csharp
services.AddScoped<IDomainEventProcessor<UserDeletedLifecycleEvent>, ErasePersonalDataOnUserDeleted>();
```

The handler runs inside the dispatcher's scope. If it throws, the message is retried and, after `MaxAttempts`, dead-lettered.
