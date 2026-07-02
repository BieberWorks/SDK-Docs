# Security

This document covers the security model of SDK-Notifications: IDOR protection, transaction guarantees, email-channel safety, and target-group limits.

## SignalR Hub — ownership enforcement

`NotificationHub` is decorated with `[Authorize]`. On `OnConnectedAsync` the hub reads
`Context.UserIdentifier` (mapped from `ClaimTypes.NameIdentifier`) and places the connection
in the user's own group (`user:{userId}`). Notifications are pushed to that group exclusively
via `INotificationHubService.PushSummaryAsync`.

No client-side `SubscribeToUser` call is needed or accepted. A client that attempts to call it
will receive a hub error — there is no server method with that name.

## List API — caller scoping

`GET /api/notifications/` derives the effective user identity from the request claim
(`ClaimTypes.NameIdentifier`). Non-admin callers always see only their own notifications,
regardless of any `userId` query parameter passed by the client. Only callers holding the
`notifications:notification:admin-view` permission may pass an arbitrary `userId`.

## Open-generic handler guard

`NotifiableEventHandler<TEvent>` contains a runtime `is not INotifiableEvent` guard. The DI
open-generic registration does not re-validate compile-time constraints at runtime; without
this guard, a non-`INotifiableEvent` type resolved through the handler would produce an
`InvalidCastException`. The guard returns early instead.

## Transaction guarantees

`NotificationsService.CreateAsync` inserts all recipient rows in a single
`ExecuteInTransactionAsync` call (via `Core.Postgres`). Side-effects — domain events, channel
dispatch, and SignalR push — happen after the commit and are individually `try/catch`ed.
A failing channel (e.g. an email send error) does not roll back the persisted notification rows.

## Email channel safety

- The `EmailChannel` receives a `NotificationDispatchContext` whose `ChannelMetadata`
  dictionary carries the recipient email under the `"recipient_email"` key (populated by
  `EmailChannelContextEnricher`) alongside the `NotificationDto`. User IDs are never used as
  email addresses.
- All HTML-interpolated fields (`Title`, `Body`, `ActionUrl`) are encoded with `HtmlEncoder`
  before being written into the email body.
- `ActionUrl` is validated before inclusion in `<a href>`: only relative URLs, `#`-prefixed
  fragments, and `http`/`https` absolute URLs are allowed.

## Target-group size limit

`NotificationTargetResolver` throws `InvalidOperationException` if a resolved group exceeds
`NotificationsOptions.MaxTargetGroupSize` (default 500). This prevents accidental
mass-notification (e.g. a misconfigured `"AllUsers"` group on a large database). Adjust the
limit in `appsettings.json`:

```json
{
  "Notifications": {
    "MaxTargetGroupSize": 1000
  }
}
```

## Permissions

Full permission string reference — see the [index](index.md#rest-api).
