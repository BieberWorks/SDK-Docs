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
permissions, the permission catalogue and the role assignments of users. Routes, wire format, error codes and protection rules are described in the
Auth module documentation (role administration API). In this image:

* Bearer tokens only (a session cookie is answered with 401); the access token needs the scope `perm` and the permission of the
  route (`auth:roles:read`, `auth:roles:manage`, `auth:users:read`, `auth:users:manage`; the administrator role has them).
  The scope is enforced: a token without it is answered with 403, also for an administrator. That covers tokens with only the
  scope `roles`, tokens of the plain login `/api/auth/login` and service-account tokens. Sign admin tools in through OpenID
  Connect with `perm`.
* Optionally restrict the API to named clients with `BieberWorks:Auth:AdminApi:AllowedClients` (the `client_id` of the token;
  environment variable `BieberWorks__Auth__AdminApi__AllowedClients__0`). Empty means every client allowed `perm` can call it,
  and the service logs a warning at start. A change needs a restart. The client administration API has its own list,
  `Oidc:AdminApi:AllowedClients`, see [configuration](20-configuration.md#operations-settings).
* The routes are not part of the OpenAPI document and are internal only (see [operations](50-operations.md#exposure)).
* Validation is strict: a role can only get permissions that are in the catalogue (own modules plus the declared external
  permissions). `*` can never be assigned through the API.
* A change takes effect for a user when the access token is renewed (15 minutes by default); there is no session revocation.
  A changed role assignment is published as `identity.user-updated` with the category `roles`, see [user events](60-user-events.md).

## Token lifetime and outages

Access tokens live 15 minutes by default (`JwtSettings:AccessTokenExpirationMinutes`). Services keep working with
cached keys while identity is down; a locked user or changed role takes effect when the token is renewed.
