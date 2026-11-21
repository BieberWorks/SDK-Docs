# Getting Started

## Registration

```csharp
// Program.cs — module self-registers via IModule discovery.
// Requires BieberWorks.SDK.Persistence.Postgres >= 2.1.0 (AddBieberWorksNpgsql, AddBieberWorksEfOutboxStore,
// AddBieberWorksOutbox); the module calls them itself.
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

### Outbox store per DbContext (Persistence 2.1)

Since 0.1.1 the module requires `BieberWorks.SDK.Persistence` / `.Persistence.Postgres` **2.1.0 or later**. The fan-out
dispatcher (`OutboxDispatcher<WebhooksDbContext>`) resolves `IOutboxStore<WebhooksDbContext>`, which the module registers via
`AddBieberWorksNpgsql` / `AddBieberWorksEfOutboxStore<WebhooksDbContext>()`. Other modules in the same host (Storage, Jobs, Auth,
…) register their own `IOutboxStore<TContext>` and can no longer replace it.

Before, the store was registered as non-generic `IOutboxStore` and the last module registered in the host won: depending on the
module order the webhooks dispatcher failed every poll (EventId 5000, no fan-out at all) or processed another module's outbox
table. Keep Persistence and Persistence.Postgres on the same version. Do not register a non-generic `IOutboxStore` for the
webhooks context yourself; a custom store must implement `IOutboxStore<WebhooksDbContext>`.

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
