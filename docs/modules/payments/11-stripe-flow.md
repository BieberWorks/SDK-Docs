# Stripe Flow

## Overview

```
User                Payments module              Stripe                 Wallet
 |                        |                          |                      |
 | POST /checkout/topup   |                          |                      |
 |----------------------->|                          |                      |
 |                        | create Checkout Session  |                      |
 |                        |------------------------->|                      |
 |                        |<-------------------------|                      |
 |<-----------------------|  session.Url             |                      |
 | (redirect to Stripe)   |                          |                      |
 |----------------------------------------------------------------->        |
 |                        |                          |  user pays           |
 |                        |  checkout.session.completed (webhook)           |
 |                        |<-------------------------|                      |
 |                        | ConfirmTopUpAsync(providerReference)            |
 |                        |------------------------------------------------>|
 |                        |                          |     credits wallet   |
 | redirect back (returnUrl, UX only)                |                      |
 |<-----------------------------------------------------------------        |
```

## 1. Checkout Session Creation

`POST /bw/payments/checkout/topup` (authenticated, gated by `Wallet:AllowSelfServiceTopUp`):

1. Resolves the caller's user id from the `sub` / `NameIdentifier` claim.
2. Calls `IWalletWriter.InitiateTopUpAsync(userId, amount, currencyCode, "stripe", returnUrl, ct)`.
3. Wallet delegates to `StripeWalletTopUpProvider.InitiateAsync`, which creates a Stripe Checkout
   Session (`Mode = "payment"`) with:
   - A stable `IdempotencyKey` (`topup:{userId}:{Guid.CreateVersion7()}`) — prevents duplicate
     sessions on client retry/double-click.
   - `SuccessUrl` / `CancelUrl` both set to the caller-supplied `returnUrl` (UX redirect only).
   - `ClientReferenceId` and `Metadata["userId"]` set to the wallet user id.
   - No `PaymentMethodTypes` — Stripe Dynamic Payment Methods decide what to offer.
4. Returns `{ providerReference, redirectUrl }` — `providerReference` is the Stripe Checkout
   Session id (`cs_...`); the host redirects the browser to `redirectUrl`.

## 2. Webhook — the Source of Truth

`POST /bw/payments/webhooks/stripe` (anonymous, signature-verified, rate-limited):

1. Verifies the `Stripe-Signature` header against `StripeOptions.WebhookSecret` using
   `EventUtility.ConstructEvent` over the **raw, unmodified** request body.
2. Deduplicates by Stripe event id against `ProcessedWebhookEventEntity` (see
   [Configuration](10-configuration.md) and the entity's unique index). Already-processed events
   are acknowledged (HTTP 200) without reprocessing — this is how Stripe's retry delivery is
   absorbed safely.
3. For event types `checkout.session.completed` and `checkout.session.async_payment_succeeded`:
   records the Checkout Session id as `ProviderReference`, then calls
   `IWalletWriter.ConfirmTopUpAsync(providerReference, ct)` — the **only** call site of
   `ConfirmTopUpAsync` in this module.
4. Other event types are acknowledged but trigger no action in Phase 1.
5. On confirmation failure: the error code is recorded on the idempotency row and the endpoint
   returns HTTP 500, so Stripe retries delivery (`StripeWebhookOutcome.TransientFailure`).
6. On invalid signature: HTTP 401 (`StripeWebhookOutcome.InvalidSignature`), no database writes.

## 3. Return URL — UX Only

`GET /bw/payments/checkout/{sessionId}/status` is a **read-only** lookup against the module's own
`ProcessedWebhookEvents` table (matched by `ProviderReference` = Stripe Checkout Session id). It
reports `"pending"`, `"confirmed"`, or `"failed"` for the checkout return page to show immediate
feedback. It **never** calls `ConfirmTopUpAsync` — crediting the wallet always happens
asynchronously via the webhook, which may arrive before or after the browser redirect completes.

## Currencies

Amounts are converted to Stripe's minor-unit integer representation honoring zero-decimal
currencies (e.g. JPY) via the ISO 4217 catalog's `DecimalDigits` (shared with SDK-Wallet). On
verification, the amount/currency returned to Wallet come **exclusively** from the Stripe session
object, never from any client-supplied value.

## Further Reading

- [Module Overview & Packages](index.md)
- [Configuration](10-configuration.md)
- [Webhook Setup](12-webhook-setup.md)
- [Security](20-security.md)
