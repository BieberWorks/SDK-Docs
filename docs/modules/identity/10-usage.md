# Usage

## For a frontend

Take either the UI meta package `BieberWorks.SDK.Identity.Frontend` (Auth client, presentation and MudBlazor skin) or
build your own UI against `/openapi/v1.json`. A server-side frontend keeps the tokens on the server (BFF) and forwards
the access token with `ServiceKit.Client` (`ServiceTokenHolder`), also inside Blazor circuits.

Links in Auth mails point to `App:PublicBaseUrl` of the identity service (the frontend): `/auth/confirm-email`,
`/auth/reset-password`, `/auth/login`.

## Seeding an administrator

Set `Auth:Bootstrap:SeedAdmin=true` with `Email` and `Password` for the first start (supply the password as a secret).
The administrator has the wildcard permission; services expand it against their own permission catalog.

## Token lifetime and outages

Access tokens live 15 minutes by default (`JwtSettings:AccessTokenExpirationMinutes`). Services keep working with
cached keys while identity is down; a locked user or changed role takes effect when the token is renewed.
