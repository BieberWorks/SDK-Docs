# Usage

## For a frontend

Take either the UI meta package `BieberWorks.SDK.Service.Identity.Frontend` (Auth client, presentation and MudBlazor skin) or
build your own UI against `/openapi/v1.json`. A server-side frontend keeps the tokens on the server (BFF) and forwards
the access token with `ServiceKit.Client` (`ServiceTokenHolder`), also inside Blazor circuits.

Links in Auth mails point to `App:PublicBaseUrl` of the identity service (the frontend): `/auth/confirm-email`,
`/auth/reset-password`, `/auth/login`.

## Seeding an administrator

Set `Auth:Bootstrap:SeedAdmin=true` with `Email` and `Password` for the first start (supply the password as a secret).
The administrator has the wildcard permission; services expand it against their own permission catalog.

## Declaring permissions of other services

Roles of this instance can carry permissions of services that do not run here (for example a forum). Identity itself does not know
those keys, so declare them in configuration; they then appear in the permission catalogue and pass the strict validation:

```json
{
  "BieberWorks": {
    "Auth": {
      "ExternalPermissions": {
        "Permissions": [
          { "Key": "forum:posts:moderate", "DisplayName": "Moderate posts", "Module": "Forum", "Group": "Posts" }
        ]
      }
    }
  }
}
```

A key is lower case with at least two colon-separated segments, at most 128 characters, never `*` and unique; `DisplayName` is
required (at most 100 characters). An invalid declaration, or a key that collides with a permission of a module running in this
image, stops the start. Declarations are read once: restart the service after a change. The service that checks the permission
(the forum) expands and checks it against its own catalogue; the administrator's `*` is expanded there.

## Managing roles for other services

The image maps the role administration API under `/api/v1/auth` (`BieberWorks:Auth:AdminApi:Enabled=true`): roles, their
permissions, the permission catalogue, the role assignments of users and the account routes below. Routes, wire format, error
codes and protection rules are described in the Auth module documentation (administration API). In this image:

* Bearer tokens only (a session cookie is answered with 401); the access token needs the scope `identity.admin`
  (`BieberWorks:Auth:AdminApi:RequiredScope`) and the user needs the permission of the route (`auth:roles:read`,
  `auth:roles:manage`, `auth:users:read`, `auth:users:manage`, `auth:users:lock`, `auth:users:delete`; the administrator role
  has them all). A token without the scope is answered with 403, also for an administrator. That covers tokens with only `perm`
  or `roles`, tokens of the plain login `/api/auth/login` and service-account tokens.
* **Rights are read live.** The token proves who calls (`sub`), the scope and the client; roles and permissions come from the
  user store on every call. A revoked role, a locked account or a deleted account takes effect on the next request, although the
  access token is still valid.
* **Admin tools.** Sign an administration tool in through OpenID Connect with the scope `identity.admin`, and add the scope to the
  allowed scopes of that client (`Oidc:Clients:<n>:Scopes`; a client created through the client API needs a
  `PUT /api/v1/oidc/clients/{clientId}` with the scope added). Give the scope to administration clients only.
* Restrict the API to named clients with `BieberWorks:Auth:AdminApi:AllowedClients` (the `client_id` of the token;
  environment variable `BieberWorks__Auth__AdminApi__AllowedClients__0`). **Outside Development the start is refused while the
  list is empty**, unless `Identity:AdminApi:AllowOpen=true`. The client administration API has its own list,
  `Oidc:AdminApi:AllowedClients`, see [configuration](20-configuration.md#operations-settings).
* The routes are not part of the OpenAPI document and are internal only (see [operations](50-operations.md#exposure)).
* Validation is strict: a role can only get permissions that are in the catalogue (own modules plus the declared external
  permissions). `*` can never be assigned through the API.
* A changed role assignment is published as `identity.user-updated` with the category `roles`, see [user events](60-user-events.md).

## Managing accounts (administrators)

Accounts can be found, blocked and erased without database access (SQL would bypass the lifecycle events, so no tombstone would
reach the consumers). The calls need `identity.admin`, the permission named, and a client on the allowlist:

| Call | Permission | Effect |
|---|---|---|
| `GET /api/v1/auth/users?email=<address>` | `auth:users:read` | Finds **one** account by its exact address (no listing): `id`, `email`, `userName`, `emailConfirmed`, `isLockedOut`, `roles`. 404 when there is none |
| `PUT /api/v1/auth/users/{id}/lock` with `{ "locked": true }` | `auth:users:lock` | Locks the account and ends its sessions; `false` unlocks. A locked user cannot sign in or refresh tokens |
| `DELETE /api/v1/auth/users/{id}` (optional `{ "erasureMode": "HardDelete" }` or `"Anonymize"`) | `auth:users:delete` | Deletes the account irreversibly, removes its Oidc tokens, authorizations and consents and queues the tombstone `identity.user-deleted` (see [user events](60-user-events.md)) |

You cannot lock or delete your own account through this API (409), nor the last active administrator (409). Example with a token
of an administration client:

```
curl -H "Authorization: Bearer $TOKEN" "https://idp.example.org/api/v1/auth/users?email=person@example.org"
curl -X DELETE -H "Authorization: Bearer $TOKEN" "https://idp.example.org/api/v1/auth/users/$ID"
```

Erasing personal data in other services is their job: they react to `identity.user-deleted`.

## Deleting your own account

`DELETE /api/v1/auth/me` (`BieberWorks:Auth:SelfServiceApi:Enabled=true` in this image) lets a signed-in user delete the own
account. It needs the access token of that account (no administration scope) and the body `{ "password": "..." }`; success is
204. The target is always the `sub` of the token, so no other account can be addressed. A wrong or missing password is 400, too
many wrong attempts 429 with `Retry-After`, the last active administrator gets 409. Accounts without a password (external
sign-in only) send `{}`; that way needs a token whose `auth_time` is at most 5 minutes old **and** a client on
`BieberWorks:Auth:SelfServiceApi:AllowedClients`, which is empty by default, so that way is closed. The same deletion path as for
administrators runs (Oidc cleanup, session eviction, tombstone with `initiator: self`). A frontend should ask for the password,
call the route with the user's token and then drop its own session.

## Token lifetime and outages

Access tokens live 15 minutes by default (`JwtSettings:AccessTokenExpirationMinutes`). Services keep working with
cached keys while identity is down; a locked or deleted user is stopped at the next refresh, a changed role takes effect in
other services when the token is renewed. The administration APIs of this image are the exception: they read the rights live.
