# Payments

The Payments module integrates Stripe Checkout as an external top-up provider for
[SDK-Wallet](https://github.com/BieberWorks/SDK-Wallet). It implements Wallet's
`IWalletTopUpProvider` extension point, exposes a self-service checkout endpoint, and receives
the Stripe webhook that is the sole source of truth for crediting a wallet.

## What the module offers

- **`IWalletTopUpProvider` implementation** — `StripeWalletTopUpProvider` creates a Stripe Checkout
  Session (`InitiateAsync`) and re-verifies a session server-side (`VerifyAsync`); registered into
  Wallet's `IEnumerable<IWalletTopUpProvider>` resolution under the provider key `"stripe"`
- **Self-service checkout endpoint** — `POST /bw/payments/checkout/topup`, gated behind the
  `Wallet:AllowSelfServiceTopUp` feature flag (SDK-Settings); off by default
- **Read-only status endpoint** — `GET /bw/payments/checkout/{sessionId}/status` for the checkout
  return-URL UX; never confirms a top-up itself
- **Stripe webhook receiver** — `POST /bw/payments/webhooks/stripe`, signature-verified and
  idempotent; the **sole caller** of `IWalletWriter.ConfirmTopUpAsync`
- **Idempotency store** — `ProcessedWebhookEventEntity` (EF Core, schema `payments`) deduplicates
  by Stripe event id, independent of Wallet's own `ConfirmedTransactionId` guard (defense in depth)
- **Built-in rate limiting** — ASP.NET Core's own rate limiter protects the webhook endpoint from
  flooding, without a dependency on a separate rate-limiting module
- **Phase 2 seam** — `ISubscriptionProvider` reserves the contract shape for future Stripe Billing
  / recurring-subscription support; intentionally empty and unimplemented in Phase 1

## Package overview

| Package | Description | When needed |
|---|---|---|
| `BieberWorks.SDK.Payments.Contracts` | `IStripePaymentOptions`, `ISubscriptionProvider` (Phase 2 seam) | When another module needs the configuration shape without a Stripe.net reference |
| `BieberWorks.SDK.Payments` | Complete implementation: EF Core (`PaymentsDbContext`, schema `payments`), `StripeWalletTopUpProvider`, Minimal API endpoints, webhook processor | In the host providing Stripe-backed wallet top-ups |

## Design principles

- **Webhook is the source of truth.** Only the Stripe webhook (`checkout.session.completed` /
  `checkout.session.async_payment_succeeded`) calls `IWalletWriter.ConfirmTopUpAsync`. The
  checkout return URL and its status endpoint are UX only — they never credit a wallet.
- **No wallet/ledger data in this module.** Payments holds no balance or transaction data; all of
  that remains Wallet's responsibility, reached exclusively via `IWalletWriter`/`IWalletReader`.
- **Defense in depth.** The webhook idempotency store protects against duplicate HTTP delivery
  *before* `ConfirmTopUpAsync` is even called, independently of Wallet's own confirmation guard.

## Documentation

| Topic | Document |
|---|---|
| Installation, `Program.cs`, connection string, rate limiting | [Getting Started](01-getting-started.md) |
| `StripeOptions`, environment variables, API key scoping | [Configuration](10-configuration.md) |
| Checkout Session flow, webhook event types, idempotency | [Stripe Flow](11-stripe-flow.md) |
| Signing secret, endpoint URL, Stripe Dashboard/CLI setup | [Webhook Setup](12-webhook-setup.md) |
| Security notes, secrets handling, threat model | [Security](20-security.md) |
| `ISubscriptionProvider` reserved seam | [Subscriptions (Phase 2)](30-subscriptions-phase2.md) |
| Release history | [Changelog](90-changelog.md) |
