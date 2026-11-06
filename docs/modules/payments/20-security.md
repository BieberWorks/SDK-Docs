# Security

## Secrets Handling

- `StripeOptions.ApiKey` and `StripeOptions.WebhookSecret` must **only ever** come from
  environment variables / a secret store backed `IConfiguration` provider. **Never** hardcode
  them or commit real values to `appsettings.json` or source control.
- Prefer a Stripe **Restricted API Key** (`rk_...`) scoped to Checkout Sessions (write + read)
  over a full Secret Key (`sk_...`) — see [Configuration](10-configuration.md).

## Webhook Signature Verification

The webhook endpoint verifies the `Stripe-Signature` header over the **raw, unmodified** request
body using `Stripe.EventUtility.ConstructEvent` and `StripeOptions.WebhookSecret`. Any tampering
with the body (including whitespace/re-encoding by an intermediate proxy) invalidates the
signature and the request is rejected with HTTP 401.

## Webhook is the Sole Source of Truth

`IWalletWriter.ConfirmTopUpAsync` is called from exactly one place in this module: the verified
Stripe webhook handler (`StripeWebhookProcessor`). The checkout return URL and its status endpoint
are UX only and never confirm a top-up — this prevents a malicious or buggy client from crediting
its own wallet by simply hitting the return URL without ever paying.

## Idempotency / Replay Protection

- Deduplication by Stripe event id (`ProcessedWebhookEventEntity.StripeEventId`, unique index)
  protects against duplicate delivery and concurrent-request races.
- `StripeWalletTopUpProvider.InitiateAsync` uses a stable per-attempt `IdempotencyKey`
  (`topup:{userId}:{Guid.CreateVersion7()}`) passed to the Stripe API, preventing duplicate
  Checkout Sessions from client retries/double-clicks.

## No PII/Secrets in Error Storage

`ProcessedWebhookEventEntity.LastError` stores only an internal error **code** (e.g.
`payments:stripe_verify_failed`) for ops visibility — never a raw Stripe exception message,
payload, or any other PII/secret.

## Amount and Currency Trust Boundary

The amount and currency used to confirm a top-up (`VerifyAsync`) come **exclusively** from the
Stripe session object retrieved server-side, never from any client-supplied request value. A
compromised or malicious client cannot influence how much a wallet is credited.

## Rate Limiting

The webhook endpoint is protected by the ASP.NET Core built-in rate limiter (fixed window, 120
requests/minute, no queueing) to limit flood/DoS exposure without blocking legitimate Stripe retry
traffic. This requires the host to call `app.UseRateLimiter()` — see
[Getting Started](01-getting-started.md).

## Further Reading

- [Module Overview & Packages](index.md)
- [Configuration](10-configuration.md)
- [Stripe Flow](11-stripe-flow.md)
- [Webhook Setup](12-webhook-setup.md)
