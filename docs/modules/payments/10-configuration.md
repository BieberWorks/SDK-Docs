# Configuration

## StripeOptions

Bound via `IOptions<StripeOptions>` from configuration section `Payments:Stripe`.

```csharp
// Namespace: BieberWorks.SDK.Payments
public sealed class StripeOptions : IStripePaymentOptions
{
    public string ApiKey { get; set; }          // Restricted API key (rk_...)
    public string WebhookSecret { get; set; }   // Webhook signing secret (whsec_...)
    public string ApiVersion { get; set; }      // Documentation-only, see below
    public string DefaultCurrency { get; set; } // ISO 4217, e.g. "eur"
}
```

| Option | Purpose | Default |
|---|---|---|
| `ApiKey` | Stripe API key used to create/verify Checkout Sessions | `string.Empty` (must be set) |
| `WebhookSecret` | Signing secret used to verify the `Stripe-Signature` header | `string.Empty` (must be set) |
| `ApiVersion` | Documents the Stripe API version this integration is built/tested against | `"2026-06-24.dahlia"` |
| `DefaultCurrency` | Fallback currency if a caller specifies none | `"eur"` |

`ApiVersion` is **not** passed to the Stripe client — Stripe.net 52.x no longer allows a
per-request API-version override; the pinned API version is baked into the SDK release itself.
Upgrading the `Stripe.net` package dependency is the supported way to move to a newer pinned API
version.

## Environment Variables

`ApiKey` and `WebhookSecret` **must only ever** come from environment variables /
`IConfiguration` providers backed by a secret store. **Never** commit real values to
`appsettings.json` or source control.

Recommended env var names (double-underscore configuration binding):

```
BW_PAYMENTS__STRIPE__APIKEY=rk_live_...
BW_PAYMENTS__STRIPE__WEBHOOKSECRET=whsec_...
```

## API Key Scoping

Prefer a Stripe **Restricted API Key** (`rk_...`) scoped to:

- Checkout Sessions — Write
- Checkout Sessions — Read

over a full Secret Key (`sk_...`). The restricted key is sufficient for both
`StripeWalletTopUpProvider.InitiateAsync` (create) and `VerifyAsync` (read), and limits blast
radius if the key ever leaks.

## Further Reading

- [Module Overview & Packages](index.md)
- [Getting Started](01-getting-started.md)
- [Stripe Flow](11-stripe-flow.md)
- [Webhook Setup](12-webhook-setup.md)
- [Security](20-security.md)
