# SDK-Identity

The identity service of the BieberWorks SDK services concept: `BieberWorks.SDK.Auth` running as its own container.
It owns users, roles, permissions and tokens; every other service only validates tokens with the published public keys.

## What the host does

* Serves the Auth REST API (`/api/auth/...`) and the OpenAPI contract at `/openapi/v1.json`.
* Signs access tokens with ES256 and publishes the public keys at `/.well-known/jwks.json` (discovery document at
  `/.well-known/openid-configuration`). Only this service holds private key material.
* Puts the audiences of the services that accept user tokens into the `aud` claim and the permissions of the user's
  roles into `perm` claims (`JwtSettings:AdditionalAudiences`, `JwtSettings:IncludePermissionClaims`).
* Issues service tokens (`POST /api/v1/auth/service-token`, client credentials) and signs its own outbox relay token.
* Sends no mails itself. Auth's mails (confirmation, password reset, two-factor code) are rendered here from the built-in
  templates and queued as `email.mail-requested` events in a persistent PostgreSQL outbox. The relay delivers them to
  the communication service (`POST /internal/events`) with retry, backoff and dead-letter. If that service is down,
  registration still succeeds and the mails follow later. The mail intent itself is durable too: Auth stores it in its
  database in the same commit as the confirmation token (`BieberWorks:Auth:MailQueue:Durable`), and the job id is the
  message id of the outbox event, so a process kill between registration and delivery loses no mail. Delivery is at-least-once; the message id lets the receiver drop repeats.
* `/health` (outbox backlog: dead letters or long-waiting entries make it `Degraded`), `/alive`, `/info`.

Database overrides and branding layouts of the Email module apply to mails sent by the communication service itself,
not to these Auth mails (the identity host has no Email module). This is a known pilot limit.

## Documents

* [Getting started](01-getting-started.md)
* [Usage](10-usage.md)
* [Configuration](20-configuration.md)
