# GDPR / Privacy — SDK-Notifications

The Notifications module implements the three SharedKernel GDPR contracts
(`IUserDataExporter`, `IUserDataEraser`, `IUserDataErasureImpactProvider`)
under `Features/Privacy`. All three are registered via `TryAddEnumerable` in
`NotificationsModule` and participate in the platform-wide erasure pipeline
orchestrated by SharedKernel without any additional host-side wiring.

For an explanation of the contracts themselves and how the orchestration pipeline
works, see the SharedKernel documentation.

---

## Data covered

| Entity | Table | Exported | Erased |
|---|---|---|---|
| Notification items | `notifications.notification_items` | Yes | Yes (hard delete) |

Notification event settings and channel configuration are global (not per-user)
and are therefore not covered by the user data pipeline.

---

## Export (`NotificationsUserDataExporter`)

Returns a `UserDataExport` with module name `BieberWorks.SDK.Notifications` and
a JSON payload with a single top-level key `notifications` — an array ordered
by `createdAt` ascending.

**Exported fields per notification:**

`id`, `userId`, `eventKey`, `title`, `body`, `actionUrl`, `isRead`, `readAt`,
`createdAt`

If the user has no notifications the array is empty. The payload uses
`JsonSerializerOptions.Web` (camelCase).

---

## Erasure (`NotificationsUserDataEraser`)

**Strategy: Hard delete — always.**

Notification items carry no legal retention requirement. Both
`ErasureMode.HardDelete` and `ErasureMode.Anonymize` result in permanent row
deletion from `notifications.notification_items`.

The operation is idempotent: a second call for the same user finds no rows and
returns `Affected = 0` without error.

**`UserErasureResult` fields after a successful run:**

| Field | Value |
|---|---|
| `ModuleName` | `BieberWorks.SDK.Notifications` |
| `Affected` | Number of rows deleted |
| `Retained` | `0` (nothing kept) |
| `RetainedReason` | `null` |

EF change-tracking is used for compatibility with both EF InMemory (unit tests)
and Npgsql (production).

---

## Impact assessment (`NotificationsErasureImpactProvider`)

Returns `null` when the user has no stored notifications. Otherwise returns a
`UserErasureImpact` with a single item:

| Severity | Message |
|---|---|
| `Warning` | `"N notification(s) will be permanently deleted."` |

The count `N` reflects the current number of `notification_items` rows for the
user. No `Blocker` items are ever raised; erasure can always proceed.

---

## Logging

| Logger class | Level | When |
|---|---|---|
| `NotificationsUserDataEraser` | `Information` | After each successful deletion; reports row count |
| `NotificationsErasureImpactProvider` | `Debug` | When notifications are present; reports count |
