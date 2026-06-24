# SDK-Notifications

The **SDK-Notifications** module provides In-App and Email notifications for BieberWorks SDK applications. Domain events implement `INotifiableEvent` to trigger the notification pipeline. Delivery channels (in-app via SignalR, email via SDK-Email) are configurable per event type through the admin UI without redeployment.

## Architecture

| Component | Role |
|---|---|
| `INotifiableEvent` | Domain events implement this interface to trigger the notification pipeline. |
| `INotificationChannel` | Pluggable delivery channel abstraction. Built-in: `InAppChannel`, `EmailChannel`. |
| `INotificationTargetResolver<TEvent>` | Resolves target user IDs from an event instance. |
| `INotificationEventRegistry` | Registers event key → display name and default channels. |
| `NotifiableEventHandler<T>` | Generic `IDomainEventProcessor<T>` that runs the full pipeline for any `INotifiableEvent`. |
| `NotificationRetentionService` | Background `IHostedService` that purges notification rows older than `RetentionDays`. |

## Packages

| Package | Purpose | Version |
|---|---|---|
| `BieberWorks.SDK.Notifications.Contracts` | Interfaces, DTOs, Permissions, `INotifiableEvent` | v0.5.0 |
| `BieberWorks.SDK.Notifications` | EF + SignalR backend, REST endpoints, retention service | v0.5.0 |
| `BieberWorks.SDK.Notifications.UI` | Framework-agnostic Blazor base classes (`NotificationBellBase`, `NotificationsInboxPageBase`, `NotificationsAdminPageBase`) | v0.5.0 |
| `BieberWorks.SDK.Notifications.UI.MudBlazor` | MudBlazor components: `NotificationBell` (AppBar widget), `NotificationsInboxPage`, `NotificationsAdminPage` | v0.5.0 |

::: tip Current version
All packages are released together. Current stable version: **v0.5.0**.
:::

## Database

- Schema: `notifications`
- One `DbContext`: `NotificationsDbContext`
- Table: `notification_items` — `Id`, `UserId`, `EventKey`, `Title`, `Body`, `ActionUrl`, `IsRead`, `ReadAt`, `CreatedAt`
- Migrations are managed inside `BieberWorks.SDK.Notifications` and applied automatically via `InitializeBieberWorksModulesAsync()`.

## SignalR

Hub path: `/hubs/notifications`.
Server pushes `NotificationSummaryDto` to connected clients via `INotificationHubService.PushSummaryAsync`.
The client (`NotificationBell`) subscribes after connect by invoking `SubscribeToUser(userId)` on the hub.

## Localization

All UI strings are served via `IStringLocalizer<NotificationsResources>` with `.resx` fallback.
German translations are in `NotificationsResources.de.resx`.
Individual strings can be overridden at runtime via `SDK-Localization` (DB override layer).

## Further Reading

- [Installation & Setup](./installation.md)
- [Usage — Events, Channels, Resolvers](./usage.md)
- [GDPR / Privacy](./gdpr-privacy.md)
