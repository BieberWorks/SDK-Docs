# Getting Started

## Registration

```csharp
// Program.cs — module self-registers via IModule discovery.
// Requires BieberWorks.SDK.Persistence.Postgres for AddBieberWorksNpgsql/AddBieberWorksOutbox.
```

Configuration keys (`appsettings.json`):

```json
{
  "ConnectionStrings": {
    "WebhooksDb": "Host=localhost;Database=bieberworks;Username=postgres;Password=postgres"
  },
  "Webhooks": {
    "BaseDelaySeconds": 30,
    "MaxDelaySeconds": 3600,
    "MaxAttempts": 8,
    "JitterMs": 5000,
    "RetentionDays": 30,
    "AllowInsecureHttpForTesting": false
  }
}
```

## Emitting a webhook-eligible domain event

Implement `IWebhookEvent` on any domain event. No reference to SDK-Webhooks is required in
the emitting module.

```csharp
public sealed record WalletTopUpCompleted(Guid WalletId, decimal Amount) : IWebhookEvent
{
    public string WebhookEventType => "wallet:topup:completed";
    public Guid WebhookEventId => WalletId; // stable id for idempotent retries
    public object WebhookPayload => new { WalletId, Amount };
}
```

Register the event type in the Admin subscription dropdown at startup:

```csharp
services.AddWebhookEventDefinition(
    "wallet:topup:completed",
    "Wallet top-up completed",
    "Fires after a wallet top-up is confirmed.");
```
