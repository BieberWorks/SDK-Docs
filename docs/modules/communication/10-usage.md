# Usage

## Sending mails from another service

Preferred: write an `email.mail-requested` event (`EmailServiceEvents.MailRequested`, payload `SubmitEmailRequest`) into
the persistent outbox of the sending service (`ServiceEventEnqueuer`). The relay delivers it with the sender's service
token. The sender needs no connection to the mail server and survives an outage of this service.

Alternative for synchronous submission: `BieberWorks.SDK.Email.Client` (`IEmailSubmissionClient`) against
`PUT /api/v1/email/messages/{id}` with a token that carries the `email:send` permission.

## Who may send

Tokens must have the audience `communication` (user tokens) or `communication-service` (service tokens, such as the identity relay) and the permission `email:send` as a `perm` claim. The identity service
puts it into tokens of administrators (wildcard) and into the service token of its relay. Ordinary users get `403`.

## For a frontend or admin website

Take `BieberWorks.SDK.Communication.Frontend` (Email client, presentation and MudBlazor skin) or build against
`/openapi/v1.json`. Poll `/health` of this service to show a status banner (`ServiceKit.Client`).
