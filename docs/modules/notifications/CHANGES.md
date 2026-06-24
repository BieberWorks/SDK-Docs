# Changelog

## next (unreleased)

### Added

- `docs/gdpr-privacy.md` — documents the GDPR privacy implementations: `NotificationsUserDataExporter` (notification items as JSON), `NotificationsUserDataEraser` (hard-delete strategy, no retention), and `NotificationsErasureImpactProvider` (Warning with row count).

## v0.5.0 (2026-06-19)

### Added

- `INotifiableEvent` interface in `Notifications.Contracts` — domain events implement this to enter the notification pipeline
- `NotifiableEventHandler<T>` open-generic `IDomainEventProcessor<T>` — auto-registered; fires the full pipeline for any `INotifiableEvent` published through Foundation messaging
- `INotificationChannel` abstraction with two built-in implementations: `InAppChannel` (persists rows + SignalR push) and `EmailChannel` (delegates to SDK-Email)
- `INotificationTargetResolver<TEvent>` — per-event resolver that returns the list of target user IDs
- `INotificationEventRegistry` — maps event keys to display names and default channels
- `NotificationsDbContext` with PostgreSQL schema `notifications`; table `notification_items`
- EF Core migrations; applied automatically via `IModuleInitializer` / `InitializeBieberWorksModulesAsync()`
- SignalR hub at `/hubs/notifications`; server pushes `NotificationSummaryDto` on new notification
- `NotificationBell` MudBlazor AppBar widget — connects to hub, shows unread count badge, opens summary drawer
- `NotificationsInboxPage` — user-facing inbox at `/account/notifications` (requires SDK-Account)
- `NotificationsAdminPage` — admin management at `/admin/notifications` with channel config and event registry overview (requires SDK-Admin and `notifications:admin:view` permission)
- `NotificationRetentionService` — background `IHostedService`; purges rows older than `RetentionDays` (default: 90 days) on startup and once daily
- Per-event channel configuration persisted in `notifications` schema; effective immediately without restart
- English and German localization via `.resx`; strings overridable at runtime via SDK-Localization DB layer
- `AddNotificationsUi()` extension method for registering all Notifications UI services
