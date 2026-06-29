# SDK-Notifications — Usage

## Raising a Notification from a Domain Event

### Step 1: Implement `INotifiableEvent`

Your domain event implements `INotifiableEvent` (alongside `IAuditableEvent` if auditing is also needed).
`INotifiableEvent` requires the following members:

| Member | Type | Description |
|---|---|---|
| `RecipientUserIds` | `IReadOnlyList<string>` | Specific user IDs to notify directly. May be empty if `TargetGroups` covers all recipients. |
| `TargetGroups` | `IReadOnlyList<string>` | Named groups (e.g. `"AllAdmins"`) resolved at dispatch via `INotificationTargetResolver`. May be empty. |
| `DefaultChannels` | `IReadOnlyList<string>` | Channels to use when no admin override is set. Convention: `"in-app"`, `"email"`. |
| `EventKey` | `string` | Stable key for channel-config overrides. Convention: `domain:entity:action`. |
| `NotificationTitle` | `string` | Short title (max 200 chars). |
| `NotificationBody` | `string?` | Optional body (max 1000 chars). |
| `NotificationActionUrl` | `string?` | Optional relative or `https` URL the notification links to. |

```csharp
public record UserInvitedEvent(string TargetUserId, string InvitedBy)
    : IDomainEvent, INotifiableEvent, IAuditableEvent
{
    // INotifiableEvent
    public IReadOnlyList<string> RecipientUserIds => [TargetUserId];
    public IReadOnlyList<string> TargetGroups => [];
    public IReadOnlyList<string> DefaultChannels => ["in-app", "email"];
    public string EventKey => "auth:user:invited";
    public string NotificationTitle => "You have been invited";
    public string? NotificationBody => $"Invited by {InvitedBy}";
    public string? NotificationActionUrl => "/account";

    // IAuditableEvent
    public string AuditAction => "UserInvited";
    public string AuditResource => "User";
    public string AuditResourceId => TargetUserId;
    public string AuditUserId => InvitedBy;
    public string? AuditDetails => null;
}
```

### Step 2: Register the event definition

Call `AddNotificationEventDefinition` after `AddBieberWorksModules()` — either in `Program.cs` or inside
your module's `RegisterServices`:

```csharp
services.AddNotificationEventDefinition(
    eventKey:        "auth:user:invited",
    displayName:     "User Invitation",
    defaultChannels: ["in-app", "email"]);
```

This registers the event key (via `INotificationEventRegistryBuilder` during startup) so it appears — read
back through `INotificationEventRegistry.GetAll()` — in the Admin channel-config UI, and gets a row seeded
in the `notification_event_settings` table on startup.

### Step 3: (Optional) Register a custom `INotificationTargetResolver`

`INotificationTargetResolver` resolves **named target groups** (from `INotifiableEvent.TargetGroups`)
to lists of user IDs. The built-in implementation already handles `"AllAdmins"` and `"AllUsers"` via
Auth.Contracts. Register a custom implementation to add application-specific groups:

```csharp
public class MyTargetResolver : INotificationTargetResolver
{
    public Task<IReadOnlyList<string>> ResolveAsync(string targetGroup, CancellationToken ct)
    {
        if (targetGroup == "PremiumUsers")
            // ... query your own data source
            return Task.FromResult<IReadOnlyList<string>>(["user-1", "user-2"]);
        return Task.FromResult<IReadOnlyList<string>>([]);
    }
}
```

Register in your module:

```csharp
services.AddScoped<INotificationTargetResolver, MyTargetResolver>();
```

If your event only uses `RecipientUserIds` (no named groups), no custom resolver is needed.

The `NotifiableEventHandler<TEvent>` is registered automatically by `AddBieberWorksModules` via open-generic DI and fires whenever the event is published through the Foundation messaging pipeline.

## Channel Configuration

Navigate to `/admin/notifications` → "Channel Config" tab to enable or disable channels per event key.

- **In-App**: stores a notification row and pushes a SignalR summary update to the user's connected Bell.
- **Email**: sends an email via `SDK-Email` (must be configured).
- Empty config = all channels disabled. "Default" = reverts to the event registration default.

Per-event settings are persisted in the `notifications` schema and take effect immediately without restart.

## Retention

Set `RetentionDays` in `appsettings.json`:

```json
{
  "Notifications": {
    "RetentionDays": 90
  }
}
```

`NotificationRetentionService` purges rows older than `RetentionDays` on startup and once daily thereafter. The default is 90 days.

## Localization

All UI strings use `IStringLocalizer<NotificationsResources>`. English (`.resx`) and German (`.de.resx`) are built in.

To override individual strings at runtime without redeployment, use `SDK-Localization`: add a DB translation entry for the key and it takes precedence over the `.resx` value via the layered localizer (DB → resx → key fallback).

## Inbox Page

The user-facing inbox is at `/account/notifications`. It requires `SDK-Account` to be installed (the page registers as an `IAccountPage`).

## Admin Page

Admin management UI at `/admin/notifications`. Requires `SDK-Admin` and the `notifications:notification:admin-view` permission (granted via `SDK-Auth` role management).
