# Queued sending API and Email.Client

Besides the in-process `IEmailSender`, the module can expose a REST API that queues mails and a typed HTTP client
that implements `IEmailSender` remotely. This is the building block for running Email as a separate service.
It is **opt-in** and additive: with default settings nothing is mapped and no background service runs.

## Server: enable the API

```json
{
  "ConnectionStrings": { "EmailDb": "..." },
  "Email": {
    "Queue": {
      "Enabled": true,
      "PollInterval": "00:00:05",
      "BatchSize": 20,
      "MaxAttempts": 8,
      "BaseRetryDelay": "00:00:30",
      "MaxRetryDelay": "01:00:00"
    }
  }
}
```

With `Enabled: true` the module maps the endpoints below and starts a dispatcher that delivers queued mails through the
configured `IEmailSender` (SMTP, rate limiting included). Failed deliveries are retried with exponential backoff and are
marked `Failed` after `MaxAttempts`. The queue lives in the `email.queue_messages` table (migration `AddQueueMessages`,
purely additive). After a successful send the message body is cleared; only the content hash is kept for idempotency.

Retention: the dispatcher removes finished rows hourly (`RetentionSweepInterval`). `SentRetention` (default 7 days) deletes
sent messages, `FailedRetention` (default 30 days) deletes failed ones, which still hold their body. A row is the
idempotency key of its message id, so keep `SentRetention` well above the redelivery window of the submitting service
(3 days by default). Zero or less keeps the rows. Rows are deleted in batches of `RetentionBatchSize` (default 1000)
and a sweep repeats batches until nothing is left, so a large backlog (for example after enabling retention for the
first time) does not run into the database command timeout.

Semantics, in two separate parts:

* **Submission is idempotent.** Submitting the same `messageId` with the same content again never queues a second mail.
* **Delivery is at-least-once, not exactly-once.** If the process dies between the mail server accepting a message and
  the status update, or a lease (`LeaseDuration`) expires while a slow send is still running, the mail is sent again, so
  a duplicate is possible in that rare case. A mail is never silently lost once `202` was returned.

Request body limit: the endpoint applies `MaxRequestBodyBytes` as its own limit, independent of Kestrel's 30 MB default
(`Kestrel:Limits:MaxRequestBodySize`). Larger bodies get `413`. Attachments are Base64 in JSON (about 4/3 of their size,
more for non-ASCII HTML), so keep the limit above `MaxTotalAttachmentBytes * 4/3 + MaxHtmlBodyLength`.

## Endpoints

| Method and path | Purpose | Success |
|---|---|---|
| `PUT /api/v1/email/messages/{messageId}` | Queue one email | `202` + `EmailSubmissionResponse` |
| `GET /api/v1/email/messages/{messageId}` | Delivery state | `200` + `EmailSubmissionResponse` |

* **Authorization:** bearer token (JWT) and the permission `email:send` (`EmailPermissions.Send`). Anonymous calls get
  `401`, callers without the permission `403`. Grant the permission to the role or service account that submits mails.
* **Idempotency:** `{messageId}` (1-200 characters of `A-Z a-z 0-9 . _ : -`) is the idempotency key chosen by the caller.
  Repeating the call with the same content returns `202` with `duplicate: true`. The same id with different content
  returns `409` with code `Email.Submission.IdempotencyConflict`.
* **Validation:** a single plain recipient address, a subject without line breaks (max 998 characters), a non-empty HTML
  body (max 2,000,000 characters), at most 10 attachments of at most 10 MB. Failures return `400` ProblemDetails with
  `code` = `Email.Submission.Invalid` and an `errors` extension (`field` to list of codes, for example
  `to: ["Email.Validation.RecipientInvalid"]`). Limits are configurable under `Email:Queue`.
* **Size limits:** the request body is read with a hard byte cap. A larger body is answered with `413` and code
  `Email.Submission.TooLarge` (no further details); it is rejected without being buffered completely. Malformed JSON gives `400`.

  | Option (`Email:Queue:`) | Default | Effect when exceeded |
  | --- | --- | --- |
  | `MaxRequestBodyBytes` | 41943040 (40 MB) | `413` |
  | `MaxMessageIdLength` | 200 | `400` (`messageId`) |
  | `MaxRecipientLength` | 254 | `400` (`to`) |
  | `MaxSubjectLength` | 998 | `400` (`subject`) |
  | `MaxHtmlBodyLength` | 2000000 | `400` (`htmlBody`) |
  | `MaxAttachments` | 10 | `400` (`attachments`) |
  | `MaxAttachmentBytes` | 10 MB | `400` (`attachments`) |
  | `MaxTotalAttachmentBytes` | 25 MB | `400` (`attachments`) |
  | `MaxFileNameLength` | 255 | `400` (`attachments`) |

  The request has exactly one recipient and no template fields, so there are no recipient-count or template limits.
  Keep `MaxRequestBodyBytes` above `MaxTotalAttachmentBytes * 4/3 + MaxHtmlBodyLength` (Base64 overhead).
* **OpenAPI:** the endpoints carry names, summaries and produced types and show up in the host's OpenAPI document.

Request body:

```json
{ "to": "user@example.com", "subject": "Welcome", "htmlBody": "<p>Hi</p>",
  "attachments": [ { "fileName": "a.pdf", "contentType": "application/pdf", "data": "<base64>" } ] }
```

## Client: Email.Client

Package `BieberWorks.SDK.Email.Client` (depends on `Email.Contracts` and `Core.Client` only).

```csharp
// Registers IEmailSubmissionClient and replaces IEmailSender with the remote implementation.
services.AddBieberWorksEmailClient("https://communication.internal/")
        .AddHttpMessageHandler<MyTokenHandler>();   // put the bearer token on the request
```

With a ServiceKit-configured client the packages stay decoupled; the host wires them by name:

```csharp
services.AddServiceHttpClient("communication", forwardUserToken: false); // ServiceKit: base address, resilience
services.AddBieberWorksEmailClientForNamedHttpClient("communication");   // client retries default to 0 here
```

* `IEmailSubmissionClient.SubmitAsync(messageId, request)` returns a `Result<EmailSubmissionResponse>`; outages surface
  as an `Unavailable` failure, never as an unhandled exception. Transient failures (network, timeout, 5xx, 429) are retried
  `EmailClientOptions.MaxRetries` times (default 2) with the same message id, so retries cannot duplicate a mail.
* `HttpEmailSender` implements `IEmailSender` on top of it. Each `SendAsync` uses a fresh message id and returns when the
  service has accepted the mail (`202`). Because `IEmailSender` has no result, a rejected or unreachable service raises
  `EmailSubmissionException` (carries the `DomainError`, no user data). Use `IEmailSubmissionClient` directly if you
  need Result-based handling or your own message ids.

### Known limits

* The client has no local persistent buffer: if the email service is unreachable after the retries, the caller gets the
  failure. For "never lose a mail" semantics, raise an event through the caller's own transactional outbox (ServiceKit
  transport) and submit from its handler with a stable message id.

## Service events and in-process submission

When Email runs as part of a service host (for example `communication`), mails can also arrive as service events instead
of REST calls. `EmailServiceEvents.MailRequested` (`email.mail-requested`) is the event type; its payload is a
`SubmitEmailRequest` and the envelope's message id becomes the idempotency key of the queued mail, so a redelivered
event never queues a second mail.

With `Email:Queue:Enabled: true` the module registers an in-process `IEmailSubmissionClient` that applies the same
validation and idempotency rules as the REST endpoint. A host's event handler calls it directly:

```csharp
var result = await submissions.SubmitAsync(envelope.MessageId, request, ct);
```
