# SDK-Notifications

The **SDK-Notifications** module provides In-App and Email notifications for BieberWorks SDK applications. Domain events implement `INotifiableEvent` to trigger the notification pipeline automatically. Delivery channels (in-app via SignalR, email via SDK-Email) are configurable per event type through the admin UI without redeployment.

## What the module offers

- **In-App notifications** — persisted in PostgreSQL, pushed in real-time to the authenticated user via SignalR hub at `/hubs/notifications`
- **Email notifications** — routed through `SDK-Email`; all user-supplied fields are HTML-encoded before dispatch
- **Open-generic event handler** — any domain event implementing `INotifiableEvent` is handled automatically by `NotifiableEventHandler<TEvent>` without per-event wiring in the host
- **Pluggable channels** — register additional `INotificationChannel` implementations in DI; the dispatcher picks them up by `ChannelKey`
- **Per-event channel config** — stored in the `notifications` schema; editable in the Admin UI at `/admin/notifications` without restart
- **Target groups** — `INotificationTargetResolver` resolves named groups (e.g. `"AllAdmins"`) to user IDs; capped by `MaxTargetGroupSize` (default 500) to prevent accidental mass-notification
- **Retention** — `NotificationRetentionService` purges rows older than `RetentionDays` (default 90) on startup and once daily
- **Bell widget** — MudBlazor `NotificationBell` AppBar component with live unread-count badge and summary drawer; hidden for anonymous users
- **User inbox** — `/account/notifications` (requires SDK-Account)
- **Admin page** — `/admin/notifications` with server-side pagination, filters, and channel-config tab (requires SDK-Admin and `notifications:notification:admin-view` permission)
- **Localization** — English and German `.resx` built in; individual strings overridable via SDK-Localization DB layer
- **GDPR** — export, erasure, and impact-assessment providers registered automatically; see [GDPR / Privacy](gdpr-privacy.md)

## Package overview

| Package | Description | When needed |
|---|---|---|
| `BieberWorks.SDK.Notifications.Contracts` | Interfaces, DTOs, permissions, `INotifiableEvent`, `INotificationsClient`, `INotificationsHubTokenProvider` | Always when another module raises or consumes notifications |
| `BieberWorks.SDK.Notifications` | EF Core + SignalR backend, REST endpoints, retention service, `InProcNotificationsClient`, `CookieNotificationsHubTokenProvider` | In the host providing the Notifications API |
| `BieberWorks.SDK.Notifications.UI` | Framework-agnostic Blazor base classes (`NotificationBellBase`, `NotificationsInboxPageBase`, `NotificationsAdminPageBase`) | Transitively — referenced by `.UI.MudBlazor` |
| `BieberWorks.SDK.Notifications.UI.MudBlazor` | Ready-made MudBlazor components: `NotificationBell`, `NotificationsInboxPage`, `NotificationsAdminPage` | When using the built-in UI in the host |
| `BieberWorks.SDK.Notifications.Client` | HTTP `INotificationsClient` for Blazor WASM and remote consumers; `NullNotificationsHubTokenProvider` for graceful Bell degradation | WASM / standalone API consumers |

::: tip Versioning
All packages are released together and share one version, computed from Conventional Commits. The latest release and full history live on the [GitHub Releases page](https://github.com/BieberWorks/SDK-Notifications/releases) (see [Changelog](CHANGES.md)).
:::

## When to use which package

| Scenario | Required packages |
|---|---|
| Another module raises a notification via `INotifiableEvent` | `Notifications.Contracts` |
| Host provides the Notifications API and in-app storage | `Notifications` |
| Host with ready-made Blazor UI (Bell + Inbox + Admin) | `Notifications` + `Notifications.UI.MudBlazor` |
| Blazor WASM / external API consumer | `Notifications.Client` + `Notifications.UI.MudBlazor` |

## Database

- Schema: `notifications`
- One `DbContext`: `NotificationsDbContext`
- Tables: `notification_items` (`Id`, `UserId`, `EventKey`, `Title`, `Body`, `ActionUrl`, `IsRead`, `ReadAt`, `CreatedAt`), `notification_event_settings` (per-event channel config)
- Migrations are managed inside `BieberWorks.SDK.Notifications` and applied automatically via `InitializeBieberWorksModulesAsync()`.

## SignalR hub

- Hub path: `/hubs/notifications`
- Hub is `[Authorize]`; the connection is placed into the user's group automatically on `OnConnectedAsync` using `Context.UserIdentifier` (mapped from `ClaimTypes.NameIdentifier`)
- No client-side `SubscribeToUser` call is needed or accepted
- Server pushes `NotificationSummaryDto` to the group via `INotificationHubService.PushSummaryAsync`
- Client method name: `"ReceiveSummary"`

## REST API

All endpoints are under `/api/notifications` and require authentication. Permission strings are defined in `NotificationPermissions`:

| Endpoint | Method | Permission |
|---|---|---|
| `/api/notifications/summary` | GET | `notifications:notification:view-own` |
| `/api/notifications/` | GET | `notifications:notification:view-own` (admins with `notifications:notification:admin-view` may pass `userId`) |
| `/api/notifications/{id}/read` | PATCH | `notifications:notification:mark-read` |
| `/api/notifications/read-all` | PATCH | `notifications:notification:mark-read` |
| `/api/notifications/` | POST | `notifications:notification:admin-create` |
| `/api/notifications/{id}` | DELETE | `notifications:notification:admin-delete` |
| `/api/notifications/event-settings` | GET | `notifications:notification:admin-config` |
| `/api/notifications/event-settings/{eventKey}` | PUT | `notifications:notification:admin-config` |

## Documentation

| Topic | Document |
|---|---|
| NuGet feed, `Program.cs`, `Routes.razor`, AppBar widget, WASM setup | [Installation & Setup](installation.md) |
| Raising notifications from domain events, channel config, retention, localization | [Usage](usage.md) |
| IDOR protection, transaction guarantees, email safety, target-group cap | [Security](security.md) |
| GDPR data export, erasure, impact assessment | [GDPR / Privacy](gdpr-privacy.md) |
| Release history | [Changelog](CHANGES.md) |
