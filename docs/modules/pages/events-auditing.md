# Events & Auditing — SDK-Pages

SDK-Pages publishes five domain events, all implementing `IAuditableEvent` (from `BieberWorks.SDK.SharedKernel`). SDK-Audit's open-generic handler (`AuditableEventHandler<TEvent>`) logs them automatically — no Pages-specific audit code is required in the consuming host.

## Domain Events

All events are defined in `BieberWorks.SDK.Pages.Contracts`.

### PageCreatedEvent

| Property | Value |
|---|---|
| `AuditAction` | `pages:page:created` |
| `AuditResource` | `Page` |
| `AuditResourceId` | Page `Id` (Guid as string) |
| `AuditUserId` | `CreatedBy` (string, nullable) |
| `AuditDetails` | `{"slug":"…","title":"…","requiredRole":null\|"…"}` |

### PageUpdatedEvent

| Property | Value |
|---|---|
| `AuditAction` | `pages:page:updated` |
| `AuditResource` | `Page` |
| `AuditResourceId` | Page `Id` |
| `AuditUserId` | `UpdatedBy` |
| `AuditDetails` | `{"slug":"…","title":"…","requiredRole":null\|"…"}` |

### PagePublishedEvent

| Property | Value |
|---|---|
| `AuditAction` | `pages:page:published` |
| `AuditResource` | `Page` |
| `AuditResourceId` | Page `Id` |
| `AuditUserId` | `PublishedBy` |
| `AuditDetails` | `null` |

### PageUnpublishedEvent

| Property | Value |
|---|---|
| `AuditAction` | `pages:page:unpublished` |
| `AuditResource` | `Page` |
| `AuditResourceId` | Page `Id` |
| `AuditUserId` | `UnpublishedBy` |
| `AuditDetails` | `null` |

### PageDeletedEvent

| Property | Value |
|---|---|
| `AuditAction` | `pages:page:deleted` |
| `AuditResource` | `Page` |
| `AuditResourceId` | Page `Id` |
| `AuditUserId` | `DeletedBy` |
| `AuditDetails` | `null` |

## RequiredRole in AuditDetails

`PageCreatedEvent` and `PageUpdatedEvent` include `RequiredRole` in `AuditDetails`. This makes it auditable when a page's visibility is restricted to a specific role, for example:

```json
{"slug":"admin-notes","title":"Admin Notes","requiredRole":"Admin"}
```

A public page (no role restriction) serializes as:

```json
{"slug":"impressum","title":"Impressum","requiredRole":null}
```

## Seeding Does Not Produce Events

Pages created by `PageSeedingService` (via `IPageProvider`) do not publish domain events. Seeding is an infrastructure operation, not an admin action — audit noise from automatic startup seeding would be misleading.

If auditing of seeded pages becomes necessary in the future, a dedicated `PageSeededEvent` can be added.

## Event Publishing

`PageAdminService` injects `IDomainEventPublisher` directly and calls `PublishAsync` after each successful database write. Events are not attached to `Result.DomainEvents` — the service is called from UI components directly, not via `IAppMessageDispatcher`.

## Auto-Audit Setup

No additional configuration is required. When SDK-Audit is installed and `AuditableEventHandler<>` is registered (open-generic), all five page events are automatically handled and written to the `audit` schema.
