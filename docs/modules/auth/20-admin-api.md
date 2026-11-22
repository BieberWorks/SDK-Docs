# Role Administration API

Roles, their permissions and the role assignments of users can be managed through one facade, `IRoleAdministration`
(`Auth.Contracts`), in two ways:

- **in-process**, registered by `AuthModule` (always available, the permission and protection rules are checked inside), and
- **over HTTP**, as an internal API under `/api/v1/auth` that a host switches on, plus an HTTP implementation of the same
  facade in `Auth.Client` for the calling side.

The typical use is an identity service that manages roles for other services: a forum declares its permission keys as
[external permissions](12-roles-permissions.md), and an administrator creates a role with them and assigns it to users.

::: warning Internal API
The API is for the **internal network**. Do not expose `/api/v1/auth/*` to the internet. It accepts bearer tokens only, and it
is not part of the OpenAPI document.
:::

## Enabling the API

The HTTP API is **off by default**; updating the package adds no endpoints to an existing host.

```json
{ "BieberWorks": { "Auth": { "AdminApi": { "Enabled": true } } } }
```

## Access token requirements

Every route needs an access token that was issued through OpenID Connect and carries the **required scope**, plus the
permission of the route. The scope is checked on the whole route group, before the permission; a token without it is answered
with 403 and no body.

- **Required scope.** `BieberWorks:Auth:AdminApi:RequiredScope` names the scope (default `perm`; one scope, no white space, at
  most 100 characters; a malformed value stops the host at start). `perm` is the scope every client asks for that wants
  permission claims, so an identity provider should name a **dedicated** scope here (for example `identity.admin`) and grant it
  only to administration clients.

  ```json
  { "BieberWorks": { "Auth": { "AdminApi": { "Enabled": true, "RequiredScope": "identity.admin" } } } }
  ```
- **Rights are read live.** The token proves who the caller is (`sub`), which scope it holds and which client it was issued to;
  it never proves what the caller may do. On every call the roles and permissions are read from the user store, so a revoked
  role, a locked account or a deleted account takes effect on the next request, although the access token is still valid. The
  `role` and `perm` claims of the token are ignored on these routes. A caller that no longer exists, is locked out or is blocked
  by the e-mail confirmation gate gets 403.

- Tokens without a `scope` claim get 403. That includes the token of the legacy `POST /api/auth/login` and service tokens, even
  when their user holds `*`. A token with only `openid roles` gets 403 as well, whatever the user may do. Another scope than the required one never
  opens the API. Scope names are compared case-sensitively.
- The scope is required at the HTTP entry only. The in-process facade (used by the Blazor admin UI with a cookie session) has no
  scope and still checks the permissions in every handler.
- **Allowed clients.** `BieberWorks:Auth:AdminApi:AllowedClients` limits the API to the listed OAuth clients. The check uses the
  `client_id` claim, else `azp`, compared case-sensitively; a token without either, or with two different values, is refused.

  ```json
  { "BieberWorks": { "Auth": { "AdminApi": { "Enabled": true, "AllowedClients": ["admin-shell"] } } } }
  ```

  The list is empty by default, which lets **every** client that was granted the required scope call the API for an
  administrator; the host logs a warning at start while the API is enabled and the list is empty. Entries must not be empty,
  contain white space or control characters, exceed 100 characters or repeat; a malformed list stops the host at start.
- `Enabled` and `AllowedClients` are read once when the endpoints are mapped. A change needs a restart.

Because the rights are read live, there is no delay between a change of roles and its effect on the administration API. (Other
services that read `role` or `perm` claims from a token still see changes only when the token is renewed.)

## Routes

All routes are under `/api/v1/auth`. Authentication scheme: `Bearer` only; a session cookie never opens the API, so no
antiforgery token is needed. Every answer carries `Cache-Control: no-store`.

| Method and route | Permission | Success |
|---|---|---|
| `GET /roles` | `auth:roles:read` | 200, list of `RoleAdminSummary` |
| `GET /roles/{roleId}` | `auth:roles:read` | 200, `RoleAdminDetail` |
| `POST /roles` | `auth:roles:manage` | 201 with `Location`, `RoleAdminDetail` |
| `PUT /roles/{roleId}` | `auth:roles:manage` | 200, `RoleAdminDetail` |
| `DELETE /roles/{roleId}` | `auth:roles:manage` | 204 |
| `PUT /roles/{roleId}/permissions` | `auth:roles:manage` | 200, `RoleAdminDetail` |
| `GET /permissions` | `auth:roles:read` | 200, list of `PermissionCatalogEntry` |
| `GET /users/{userId}/roles` | `auth:users:read` | 200, `UserRoleAssignment` |
| `PUT /users/{userId}/roles/{roleId}` | `auth:users:manage` | 204 (idempotent) |
| `DELETE /users/{userId}/roles/{roleId}` | `auth:users:manage` | 204 (idempotent) |
| `GET /users?email=` | `auth:users:read` | 200, `AdminUserSummary` |
| `PUT /users/{userId}/lock` | `auth:users:lock` | 204 (idempotent) |
| `DELETE /users/{userId}` | `auth:users:delete` | 204 |

Roles are addressed by **id**, which does not change when a role is renamed. User assignments are single operations (one role per
call) instead of a replace-set, so two administrators working at the same time cannot overwrite each other.

Request bodies are limited to 64 KB (the largest legitimate request, 500 permission keys, is far smaller). A bigger body is
refused with 413 and `Auth.Admin.RequestTooLarge` before it is parsed.

### Account lifecycle

The last three routes manage accounts, so that an account can be found, blocked and erased without access to the database
(which would bypass the lifecycle events).

- `GET /users?email=alice@example.com` finds **one** account by its exact e-mail address (no listing, no partial match). 200
  with `{ id, email, userName, emailConfirmed, isLockedOut, roles }`, 404 `Auth.Admin.UserNotFound` when there is none, 400 when
  the address is blank or longer than 256 characters.
- `PUT /users/{userId}/lock` with `{ "locked": true }` locks the account permanently and **ends all its sessions**; `false`
  unlocks it (ended sessions stay ended). Repeating the call is harmless and publishes the `UserLockStateChangedEvent` only when
  the state changes. A locked user cannot sign in and cannot refresh tokens.
- `DELETE /users/{userId}` deletes the account through the same path as every other deletion: the impact gate of the modules
  that registered an `IUserDataErasureImpactProvider` runs first, the sessions are dropped, the `UserAccountDeletionRequestedEvent`
  is published and the lifecycle outbox writes the `auth.user-deleted.v1` tombstone (see [User Lifecycle Events](19-user-lifecycle-events.md)).
  The optional body `{ "erasureMode": "HardDelete" }` (default) or `"Anonymize"` selects how consumers erase their data; an
  unknown value is 400. Deletion is **irreversible**; the account is addressed by its exact id, there is no bulk form.

Rules (answered with problem details):

| Situation | Answer |
|---|---|
| The caller targets its own account (lock or delete) | 409 `Auth.Admin.SelfLockForbidden` / `Auth.Admin.SelfDeleteForbidden` |
| The change would leave nobody with full access (lock or delete of the last active administrator) | 409 `Auth.Admin.LastAdministrator` |
| The target holds more permissions than the caller (a caller without full access may not touch an account with `*` or with a permission it lacks itself) | 403 `Auth.Admin.UserNotManageable` |
| A module blocks the deletion (impact gate) | 409 `Auth.Admin.UserDeletionBlocked` |

A locked or unconfirmed administrator is not counted as an administrator, so such an account can be deleted although it holds a
wildcard role.

**Concurrency.** Counting the active administrators and the delete (or the lock) run in **one serializable transaction**, and the
administrators are counted a second time before the commit. Two administrators that delete each other, lock each other, or one
that locks while the other deletes, therefore cannot both succeed: PostgreSQL aborts one transaction, the execution strategy
retries it, and the retry is refused with `Auth.Admin.LastAdministrator`; if the second count finds nobody left, the change is
rolled back instead of committed. The retry relies on `EnableRetryOnFailure`, which `AuthModule` enables for its `AuthDbContext`
(a host that replaces the context options without it would see the aborted request fail with a database error, never an empty
administrator set). Without a relational provider (in-memory databases in tests) no transaction is used and the safeguard
reduces to the check before the write.

## Self-service: deleting your own account

`DELETE /api/v1/auth/me` lets a signed-in user delete **their own** account (GDPR Art. 17). It is a separate, opt-in API (off by
default, so an update adds no endpoint):

```json
{ "BieberWorks": { "Auth": { "SelfServiceApi": { "Enabled": true } } } }
```

- **Who.** A bearer access token of the account; no administration scope is needed. The target is always the `sub` of the token;
  the route carries no id, so another account cannot be addressed. A locked account gets 403, an unknown one 404.
- **Re-confirmation.** The body is `{ "password": "..." }` and the password is checked before anything else (a wrong password
  never reveals whether the account is the last administrator): wrong or missing is 400 `Identity.User.InvalidPassword`. Wrong
  attempts are limited per user (`auth-self-delete-by-user`, 5 attempts per 15 minutes, then 15 minutes lockout; 429
  `Identity.User.TooManyAttempts` with `Retry-After`); a right password resets the budget.
- **Accounts without a password** (external sign-in only) send `{}`. This way needs a recent sign-in as proof: the token must
  carry an `auth_time` claim that is at most 5 minutes old, **and** its client (`client_id`, else `azp`) must be on
  `BieberWorks:Auth:SelfServiceApi:AllowedClients`. The list is **empty by default, which closes this way for every client**
  (fail closed): such an account then gets 403 `Identity.User.ReauthRequired` whatever the token says, and the host logs a
  warning at start while the API is enabled and the list is empty. Entries follow the same rules as the administration
  allowlist (not empty, no white space or control characters, at most 100 characters, no duplicates; a malformed list stops the
  host at start). An account **with** a password always needs the password, from any client with a valid token.

  ```json
  { "BieberWorks": { "Auth": { "SelfServiceApi": { "Enabled": true, "AllowedClients": ["web-app"] } } } }
  ```
- **Last administrator.** The last active administrator cannot delete the account (409 `Auth.Admin.LastAdministrator`).
- **Same deletion path** as the administration API (impact gate, lifecycle tombstone with `initiator: self`, session eviction).
  Success is 204 and the access token is useless afterwards: refresh reads the user again and the account is gone.
- Every answer carries `Cache-Control: no-store`; a session cookie is never accepted.

## Wire format

JSON, camelCase, enums as strings (`AuthWire.JsonOptions`).

```jsonc
// POST /api/v1/auth/roles
{ "name": "forum-moderator", "description": "Moderates the forum", "permissionKeys": ["forum:posts:moderate"] }

// 201 Created, Location: /api/v1/auth/roles/3b1f...
{
  "id": "3b1f...",
  "name": "forum-moderator",
  "description": "Moderates the forum",
  "isSystemRole": false,
  "hasWildcard": false,
  "permissionKeys": ["forum:posts:moderate"],
  "uncataloguedKeys": [],
  "concurrencyStamp": "8c0d..."
}
```

| Request | Members |
|---|---|
| `RoleCreateRequest` | `name` (1 to 100 characters after trimming), `description?` (at most 500), `permissionKeys?` |
| `RoleUpdateRequest` | `name?`, `description?` (`null` leaves a member unchanged), `concurrencyStamp` (required) |
| `RolePermissionsRequest` | `permissionKeys` (the complete target set, at most 500), `concurrencyStamp` (required) |

`concurrencyStamp` comes from the last read of the role. If someone changed the role in between, the call fails with
`Auth.Admin.ConcurrencyConflict` (409) and nothing is changed; read the role again and retry.

`PermissionCatalogEntry` is `{ key, displayName, module, group, description, isExternal }`; `isExternal` marks keys declared
through `BieberWorks:Auth:ExternalPermissions`. `uncataloguedKeys` of a role lists the assigned keys that are not in this
instance's catalog (unknown or obsolete).

## Errors

Failures are problem details (`application/problem+json`) with the extension `code` and a localized `detail` (English and German).
Rejected permission keys are listed in the extension `keys`.

```json
{ "type": null, "title": "Bad Request", "status": 400, "detail": "One or more permission keys are not valid. ...",
  "instance": "/api/v1/auth/roles", "code": "Auth.Admin.PermissionInvalid", "keys": ["*"] }
```

A request that fails the route's permission policy is answered by the authorization middleware (401 or 403 without a body);
the handlers check the permission again, so the same rule holds for the in-process facade.

| Code | HTTP | Meaning |
|---|---|---|
| `Auth.Admin.RequestInvalid` | 400 | Body missing or malformed, a stamp or key list missing, too many keys |
| `Auth.Admin.RequestTooLarge` | 413 | Body larger than 64 KB |
| `Auth.Admin.RoleNameInvalid` | 400 | Name empty, longer than 100 characters, or containing control, format, line or paragraph separator, private-use, unassigned or lone surrogate characters (it is stored in Unicode form C) |
| `Auth.Admin.DescriptionInvalid` | 400 | Description longer than 500 characters or containing the same kinds of characters as a name, except that tab, line feed and carriage return are allowed |
| `Auth.Admin.PermissionInvalid` | 400 | A key is `*` or malformed; `keys` lists them |
| `Auth.Admin.PermissionUnknown` | 400 | A key is not in the catalog; `keys` lists them |
| `Auth.Admin.Forbidden` | 403 | The caller lacks the permission (inside the handlers; a token without the scope or client is answered by the middleware with 403 and no body) |
| `Auth.Admin.PermissionNotHeld` | 403 | The caller tried to add or remove a permission it does not hold |
| `Auth.Admin.RoleNotAssignable` | 403 | The role holds more than the caller does |
| `Auth.Admin.SelfModificationForbidden` | 403 | The caller tried to change its own assignments |
| `Auth.Admin.UserNotManageable` | 403 | The target account holds more permissions than the caller |
| `Auth.Admin.SelfLockForbidden`, `Auth.Admin.SelfDeleteForbidden` | 409 | The caller tried to lock or delete its own account through the administration API |
| `Auth.Admin.UserDeletionBlocked` | 409 | Another module blocks the deletion of the account |
| `Auth.Admin.RoleNotFound`, `Auth.Admin.UserNotFound` | 404 | Unknown id |
| `Auth.Admin.RoleNameTaken` | 409 | Name already used (case-insensitive; also when two requests create the same name at once) |
| `Auth.Admin.SystemRoleProtected` | 409 | System roles cannot be renamed or deleted |
| `Auth.Admin.WildcardRoleProtected` | 409 | See protection rules |
| `Auth.Admin.LastAdministrator` | 409 | Nobody would be left with full access |
| `Auth.Admin.ConcurrencyConflict` | 409 | Stale `concurrencyStamp` |
| `Identity.User.InvalidPassword`, `Identity.User.TooManyAttempts`, `Identity.User.ReauthRequired` | 400, 429, 403 | Self-service deletion: wrong or missing password, too many attempts, fresh sign-in needed |
| `Auth.Admin.TooManyRequests` | 429 | Rate limit exceeded; `Retry-After` is set |

## Protection rules

The API hands out rights, so it limits itself; the rules apply to every entry (HTTP, facade) because they are checked inside the
handlers.

1. **System roles** (`Admin`, `Customer`, `User`) cannot be renamed or deleted.
2. **Wildcard roles** (a role that carries `*`) cannot have their permissions edited. Renaming or deleting one needs a caller with full access. The API cannot create a wildcard role: `*` is always invalid.
3. **Grant only what you hold.** A caller without full access can add or remove only permission keys it holds itself. It can assign, remove, **rename or delete** a role only if the role's permissions are a subset of its own (`Auth.Admin.RoleNotAssignable` otherwise); roles with `*` only with full access. Changing only the description of a role is not restricted by this rule.
4. **Self-protection.** A caller cannot change its own role assignments.
5. **Last administrator.** Removing a wildcard role from the last user who holds one, or deleting the last wildcard role that has members, is refused. Only accounts that can sign in are counted (not locked out, e-mail confirmed when `SignIn:RequireConfirmedEmail` is on). Roles are counted; a wildcard stored directly as a user claim is not.
   - *Deleting a wildcard role* checks and deletes in one **serializable transaction**. Two administrators deleting "the other" role at the same moment cannot both succeed: PostgreSQL aborts one, the execution strategy retries it, and the retry is refused with `Auth.Admin.LastAdministrator`. This relies on the retry strategy that `AuthModule` enables for its `AuthDbContext` (`EnableRetryOnFailure`); a host that replaces the context options without it would see the aborted request fail with a database error instead of the refusal, but never an empty administrator set.
   - *Removing a role from a user* checks before and again after the write (read-then-write). If two administrators remove each other at the same moment, the second change is put back and refused. If putting it back fails, the call fails with an unexpected error and a **critical** log entry says that the role assignment must be repaired by hand.
6. **Strict validation.** Newly added keys must be well-formed and in the catalog, whatever `PermissionValidation:Mode` says. Keys a role already holds are not re-validated and can be removed.
7. **Optimistic concurrency** through `concurrencyStamp`; every permission change renews the stamp. The role is updated first (which rejects a stale stamp before any claim is touched), then the permission claims are written one by one. A failure in the middle of that sequence (for example the database going away) can leave a part of the change applied and the stamp already renewed; the operation is set-based, so repeating it with the new stamp completes it.

"Full access" means the caller holds `*`, either as a claim or through a role.

## Rate limits

Reads and writes have their own limits per acting user (`sub`):

| Policy | Default |
|---|---|
| `auth-admin-read-by-actor` | 300 per minute |
| `auth-admin-write-by-actor` | 30 per minute (also lock and delete) |
| `auth-self-delete-by-user` | 5 wrong passwords per 15 minutes, then 15 minutes lockout |

Override them like any rate-limit policy, for example `RateLimiting:Policies:auth-admin-write-by-actor` when the
`RateLimiting` module is used. A request without the permission does not use up the budget.

## Audit and logging

The existing auditable events are published, with the acting user in `AuditUserId`: `RoleCreatedEvent`, `RoleUpdatedEvent`,
`RoleDeletedEvent`, `RolePermissionsChangedEvent` (added and removed keys), `UserRolesChangedEvent` (added and removed
roles), `UserLockStateChangedEvent` and `UserAccountDeletionRequestedEvent`. The acting user is the `sub` claim of the bearer token. A host without an audit module publishes the events but
persists nothing. Refused attempts are logged as warnings with the actor and the error code; request bodies, key lists supplied
by callers and tokens are never logged.

## Calling the API from another service

```csharp
services.AddSingleton<IAuthAdminTokenSource, MyTokenSource>();   // returns the access token; never logged
services.AddAuthRoleAdminClient(o => o.BaseAddress = new Uri("https://identity.internal/"));

// anywhere:
Result<RoleAdminDetail> role = await admin.CreateRoleAsync(
    new RoleCreateRequest("forum-moderator", null, ["forum:posts:moderate"]), ct);
if (!role.Success)
    // role.Errors.First() has the same Code and Type as in-process; for permission errors it is an
    // InvalidPermissionKeysError with Keys.
```

`AddAuthRoleAdminClient` returns the `IHttpClientBuilder`, so resilience handlers can be added. There is no default
`IAuthAdminTokenSource`; the host registers one. Without a token the call fails with `Client.Unauthenticated` and nothing is sent;
a provider that cannot be reached gives `Client.Unavailable`.

## Upgrade notes (4.10)

- **`AuthAdminApiOptions.RequiredScope` is now a property.** It was the constant `"perm"`; code that read the constant must use
  `AuthAdminApiOptions.DefaultRequiredScope` (same value) or the configured `RequiredScope` of the options instance. This is a
  source break for such code only; the default scope stays `perm`, so a host that configures nothing behaves as before with
  respect to the scope.
- **The caller is read live.** `role` and `perm` claims of the token no longer grant anything on `/api/v1/auth`. A service
  principal or test token without a stored user account is now answered with 403, because there is no account to read the
  rights from.
- New opt-in settings: `AdminApi:RequiredScope`, `SelfServiceApi:Enabled`, `SelfServiceApi:AllowedClients`. New permissions
  `auth:users:lock` and `auth:users:delete` must be granted to roles that use the new routes (the wildcard covers them).
- `DeleteUserCommand` keeps its earlier four-parameter constructor; the new parameter `FreshSignIn` is optional. The record's
  `Deconstruct` now has five `out` parameters instead of four, so code that deconstructs it needs a fifth variable (or a discard).
  `UserManagementService` (internal) takes the shared lock executor and the current-principal accessor; hosts that register
  `AuthModule` need no change.
- `IUserManagementService.DeleteUserAsync(userId, actorUserId, mode, ct)` is obsolete: the actor is now always the signed-in
  user, so the argument is ignored. Use the new `DeleteUserAsync(userId, mode, ct)`. A call without a signed-in user (a
  background job, a test without a principal) is refused with `Auth.Admin.Forbidden`; likewise `SetUserLockedAsync`.

## Limits

- The legacy `PUT /api/admin/users/{userId}/roles` of `Auth.Management` follows the same assignment rules. A refusal is thrown as `RoleAssignmentRejectedException` (derives from `InvalidOperationException`, has `Code` and `Error`) and answered by the endpoint as 403 or 409 problem details with `code`; the admin user page shows the localized text.
- The Admin UI of this module (`RoleEditViewModel` and the user pages) still uses `IRoleManagementService` directly and does not go through `IRoleAdministration`; it does not yet apply the escalation rules of the API for the role editor. Moving it over is a breaking change of the view-model constructors and is planned for the next major version.
- The rule "an actor without full access may not lock or delete an account that holds more than it does"
  (`Auth.Admin.UserNotManageable`) lives in the shared handlers, so every entry applies it: the administration API, the
  management REST endpoints (`PUT /api/admin/users/{id}/lock`, `DELETE /api/admin/users/{id}`) and the user pages. It **fails
  closed**: the actor is the signed-in user (the `sub` of a bearer token, which is all such a token carries), never a value the
  caller supplies. No actor id gives 403 `Auth.Admin.Forbidden`; an id that is no account (an unknown id, a service token such
  as `svc:...`) gives 403 `Auth.Admin.UserNotManageable`. There is no "system" exemption, because nothing in the SDK locks or
  deletes accounts without a signed-in actor. The management endpoints answer a refusal with 403 or 409 problem details (`code`)
  instead of a server error. Locking through the management service also runs under the serializable transaction and refuses to
  lock the last active administrator.
- The facade `IRoleAdministration` and the `AddAuthRoleAdminClient` HTTP client cover roles and role assignments only. The three
  account routes (lookup, lock, delete) are plain HTTP routes without a client wrapper yet.
- The administration API reads the caller live, so it needs the user store of Auth; the permission catalogue must contain
  `auth:users:lock` and `auth:users:delete` (registered by `AuthModule`) for a caller with `*` to be allowed to use them.
