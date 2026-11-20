# SDK-Communication

The communication service of the BieberWorks SDK services concept: `BieberWorks.SDK.Email` running as its own container.
It owns the mail queue and the mail server connection; other services never talk SMTP.

## What the host does

* Validates access tokens with the public keys of the identity service (JWKS via OpenID discovery). It holds no secret
  and no private key. Expected audience: `communication` (user tokens) or `communication-service` (service tokens).
* **Event inbox** `POST /internal/events` (protected by the policy `perm:email:send`, so a user token with the same
  audience is rejected with `403`; the permission is meant for service accounts only, so do not grant `email:send` to user
  roles). The event `email.mail-requested` becomes a queued mail; the envelope's message id is
  the idempotency key. Processed message ids are stored in PostgreSQL, so a redelivery after a restart changes nothing.
* **Queued sending API** `PUT /api/v1/email/messages/{id}` and `GET /api/v1/email/messages/{id}` (permission
  `email:send`), see the Email module docs.
* A queue dispatcher sends queued mails with retry and exponential backoff (at-least-once towards the mail server; a
  crash between SMTP acceptance and the status update repeats that mail).
* `/health` (database reachable, outbox/inbox tables), `/alive`, `/info`.

If an event can never be turned into a mail (missing or undecodable payload, a payload such as `{}` or an invalid address
that the queue refuses, the same message id with other content), the inbox answers `422`: the sending service dead-letters
the entry at once instead of retrying it, which turns its `/health` to `Degraded`. Other failures (for example the database
being unreachable) stay transient (`500`/`503`) and are retried.

## Documents

* [Getting started](01-getting-started.md)
* [Usage](10-usage.md)
* [Configuration](20-configuration.md)
