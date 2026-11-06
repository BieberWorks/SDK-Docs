# Webhook Setup

## Endpoint

```
POST /bw/payments/webhooks/stripe
```

- Anonymous by design — Stripe cannot present cookie/JWT auth. Authentication is replaced by
  Stripe signature verification (see below).
- Antiforgery is disabled for this endpoint (`DisableAntiforgery()`) — Stripe does not send an
  antiforgery token.
- Protected by the built-in ASP.NET Core rate limiter policy `payments-stripe-webhook`
  (`RequireRateLimiting`) — see [Getting Started](01-getting-started.md) for the required
  `app.UseRateLimiter()` host wiring.

## Stripe Dashboard / CLI Configuration

1. In the Stripe Dashboard, go to **Developers → Webhooks → Add endpoint**.
2. Set the endpoint URL to your host's public address plus the path above, e.g.:
   ```
   https://your-host.example.com/bw/payments/webhooks/stripe
   ```
3. Select at least these events:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
4. Copy the **Signing secret** (`whsec_...`) shown after creating the endpoint into
   `StripeOptions.WebhookSecret` (via the `BW_PAYMENTS__STRIPE__WEBHOOKSECRET` environment
   variable — see [Configuration](10-configuration.md)).

## Local Development (Stripe CLI)

```powershell
stripe listen --forward-to https://localhost:5001/bw/payments/webhooks/stripe
```

The CLI prints a local signing secret (`whsec_...`) — use that value for local development instead
of the Dashboard's production secret.

## Idempotency

Every incoming event is deduplicated by its Stripe event id (`Event.Id`) against
`ProcessedWebhookEventEntity.StripeEventId`, enforced by a unique index at the database level.
This protects against duplicate HTTP delivery (Stripe retries) and concurrent request races,
independently of Wallet's own `ConfirmedTransactionId` guard inside `ConfirmTopUpAsync` — the two
layers are intentionally redundant (defense in depth).

## Further Reading

- [Module Overview & Packages](index.md)
- [Configuration](10-configuration.md)
- [Stripe Flow](11-stripe-flow.md)
- [Security](20-security.md)
