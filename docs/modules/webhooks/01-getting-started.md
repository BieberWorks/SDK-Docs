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
    "OutboxBaseRetryDelaySeconds": 5,
    "OutboxMaxRetryDelaySeconds": 300,
    "AllowInsecureHttpForTesting": false
  }
}
```

`PollIntervalSeconds` and `BatchSize` also apply to the internal fan-out outbox. `OutboxBaseRetryDelaySeconds` /
`OutboxMaxRetryDelaySeconds` control the exponential backoff of that outbox (event to delivery rows, defaults 5 s / 5 min,
dead-letter after 10 attempts, about 20 minutes); they are separate from the HTTP delivery backoff
(`BaseDelaySeconds` / `MaxDelaySeconds`).

### Upgrading to Persistence 2.x

This version requires `BieberWorks.SDK.Persistence` / `.Persistence.Postgres` 2.x and adds the migration
`AddOutboxNextAttemptOnUtc` (nullable column `webhooks.outbox_messages."NextAttemptOnUtc"`, additive). The module applies it
at startup via `MigrateAsync`. Update Auth, Jobs and Webhooks together in a host: a module without its migration fails at
startup (pending model changes) when it runs against Persistence 2.x.

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
