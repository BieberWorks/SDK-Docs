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

The caller needs an access token with the scope `perm` (so the permission claims reach the token) and the permission of the
route. Changes to roles take effect for a user when the access token is renewed (the token lifetime, 15 minutes by default);
there is no session revocation.

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

Roles are addressed by **id**, which does not change when a role is renamed. User assignments are single operations (one role per
call) instead of a replace-set, so two administrators working at the same time cannot overwrite each other.

Request bodies are limited to 64 KB (the largest legitimate request, 500 permission keys, is far smaller). A bigger body is
refused with 413 and `Auth.Admin.RequestTooLarge` before it is parsed.

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
| `Auth.Admin.RoleNameInvalid` | 400 | Name empty or longer than 100 characters |
| `Auth.Admin.DescriptionInvalid` | 400 | Description longer than 500 characters |
| `Auth.Admin.PermissionInvalid` | 400 | A key is `*` or malformed; `keys` lists them |
| `Auth.Admin.PermissionUnknown` | 400 | A key is not in the catalog; `keys` lists them |
| `Auth.Admin.Forbidden` | 403 | The caller lacks the permission |
| `Auth.Admin.PermissionNotHeld` | 403 | The caller tried to add or remove a permission it does not hold |
| `Auth.Admin.RoleNotAssignable` | 403 | The role holds more than the caller does |
| `Auth.Admin.SelfModificationForbidden` | 403 | The caller tried to change its own assignments |
| `Auth.Admin.RoleNotFound`, `Auth.Admin.UserNotFound` | 404 | Unknown id |
| `Auth.Admin.RoleNameTaken` | 409 | Name already used (case-insensitive) |
| `Auth.Admin.SystemRoleProtected` | 409 | System roles cannot be renamed or deleted |
| `Auth.Admin.WildcardRoleProtected` | 409 | See protection rules |
| `Auth.Admin.LastAdministrator` | 409 | Nobody would be left with full access |
| `Auth.Admin.ConcurrencyConflict` | 409 | Stale `concurrencyStamp` |
| `Auth.Admin.TooManyRequests` | 429 | Rate limit exceeded; `Retry-After` is set |

## Protection rules

The API hands out rights, so it limits itself; the rules apply to every entry (HTTP, facade) because they are checked inside the
handlers.

1. **System roles** (`Admin`, `Customer`, `User`) cannot be renamed or deleted.
2. **Wildcard roles** (a role that carries `*`) cannot have their permissions edited. Renaming or deleting one needs a caller with full access. The API cannot create a wildcard role: `*` is always invalid.
3. **Grant only what you hold.** A caller without full access can add or remove only permission keys it holds itself. It can assign, remove, **rename or delete** a role only if the role's permissions are a subset of its own (`Auth.Admin.RoleNotAssignable` otherwise); roles with `*` only with full access. Changing only the description of a role is not restricted by this rule.
4. **Self-protection.** A caller cannot change its own role assignments.
5. **Last administrator.** Removing a wildcard role from the last user who holds one, or deleting the last wildcard role that has members, is refused. Roles are counted; a wildcard stored directly as a user claim is not.
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
| `auth-admin-write-by-actor` | 30 per minute |

Override them like any rate-limit policy, for example `RateLimiting:Policies:auth-admin-write-by-actor` when the
`RateLimiting` module is used. A request without the permission does not use up the budget.

## Audit and logging

The existing auditable events are published, with the acting user in `AuditUserId`: `RoleCreatedEvent`, `RoleUpdatedEvent`,
`RoleDeletedEvent`, `RolePermissionsChangedEvent` (added and removed keys) and `UserRolesChangedEvent` (added and removed
roles). The acting user is the `sub` claim of the bearer token. A host without an audit module publishes the events but
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

## Limits

- The legacy `PUT /api/admin/users/{userId}/roles` of `Auth.Management` follows the same assignment rules. A refusal is thrown as `RoleAssignmentRejectedException` (derives from `InvalidOperationException`, has `Code` and `Error`) and answered by the endpoint as 403 or 409 problem details with `code`; the admin user page shows the localized text.
- The Admin UI of this module (`RoleEditViewModel` and the user pages) still uses `IRoleManagementService` directly and does not go through `IRoleAdministration`; it does not yet apply the escalation rules of the API for the role editor. Moving it over is a breaking change of the view-model constructors and is planned for the next major version.
- Changes apply to a user when the access token is renewed.
