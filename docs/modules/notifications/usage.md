# SDK-Notifications — Usage

## Raising a Notification from a Domain Event

### Step 1: Implement `INotifiableEvent`

Your domain event implements `INotifiableEvent` (alongside `IAuditableEvent` if auditing is also needed):

```csharp
public record UserInvitedEvent(string TargetUserId, string InvitedBy)
    : IDomainEvent, INotifiableEvent, IAuditableEvent
{
    // IAuditableEvent props ...
    public string AuditAction => "UserInvited";
    public string AuditResource => "User";
    public string AuditResourceId => TargetUserId;
    public string AuditUserId => InvitedBy;
    public string? AuditDetails => null;
}
```

### Step 2: Register the Event in `INotificationEventRegistry`

Inside your module's `RegisterServices`:

```csharp
services.AddSingleton<INotificationEventRegistry>(sp =>
{
    var registry = new NotificationEventRegistry();
    registry.Register("user.invited", "User Invitation", defaultChannels: ["in-app", "email"]);
    return registry;
});
```

### Step 3: Implement `INotificationTargetResolver<TEvent>`

```csharp
public class UserInvitedTargetResolver : INotificationTargetResolver<UserInvitedEvent>
{
    public Task<IReadOnlyList<string>> ResolveTargetsAsync(UserInvitedEvent evt, CancellationToken ct)
        => Task.FromResult<IReadOnlyList<string>>([evt.TargetUserId]);
}
```

Register in your module:

```csharp
services.AddScoped<INotificationTargetResolver<UserInvitedEvent>, UserInvitedTargetResolver>();
```

The `NotifiableEventHandler<UserInvitedEvent>` is registered automatically by `AddBieberWorksModules` via open-generic DI and fires whenever the event is published through the Foundation messaging pipeline.

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

Admin management UI at `/admin/notifications`. Requires `SDK-Admin` and the `perm:notifications.admin.view` permission (granted via `SDK-Auth` role management).
