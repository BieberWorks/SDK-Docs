# Getting Started

## Installation

Add the package to your host project:

```xml
<!-- Core Stripe integration: IWalletTopUpProvider + REST endpoints -->
<PackageReference Include="BieberWorks.SDK.Payments" Version="1.*-*" />

<!-- Consumer modules that only need the configuration shape -->
<PackageReference Include="BieberWorks.SDK.Payments.Contracts" Version="1.*-*" />
```

Payments requires `BieberWorks.SDK.Wallet` in the same host — it registers its provider into
Wallet's `IEnumerable<IWalletTopUpProvider>` resolution and calls `IWalletWriter` directly.

## Program.cs Registration

```csharp
// Registers PaymentsModule automatically via IModule discovery — this wires up
// PaymentsDbContext (schema "payments"), StripeWalletTopUpProvider, the webhook processor,
// and the built-in ASP.NET Core rate limiter policy for the webhook endpoint.
builder.Services.AddBieberWorksModules(builder.Configuration);

var app = builder.Build();

// REQUIRED: without this, the webhook endpoint still works but is NOT rate-limited.
app.UseRateLimiter();

app.MapBieberWorksModules();
```

## Connection String

```json
{
  "ConnectionStrings": {
    "PaymentsDb": "Host=localhost;Database=mydb;Username=postgres;Password=..."
  }
}
```

If `PaymentsDb` is absent, `DefaultConnection` is used as a fallback.

## Migrations

`PaymentsModule` implements `IModuleInitializer` and applies pending EF Core migrations
automatically at host startup (`db.Database.MigrateAsync()`). No manual `dotnet ef database
update` step is required in a running host.

## Enabling Self-Service Top-Up

The `POST /bw/payments/checkout/topup` endpoint is gated behind the `Wallet:AllowSelfServiceTopUp`
feature flag (SDK-Settings), off by default. Enable it via the Settings admin UI or
`ISettingsService` before end users can initiate a Stripe Checkout session themselves.

## Further Reading

- [Module Overview & Packages](index.md)
- [Configuration](10-configuration.md)
- [Stripe Flow](11-stripe-flow.md)
- [Webhook Setup](12-webhook-setup.md)
- [Security](20-security.md)
