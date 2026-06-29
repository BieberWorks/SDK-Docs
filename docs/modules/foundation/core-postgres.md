# Core.Postgres

`BieberWorks.SDK.Core.Postgres` centralizes the PostgreSQL data-layer concerns every SDK module with a `DbContext` would otherwise hand-roll: resilient transactions, optimistic-concurrency retry, and the standard Npgsql registration block.

## The problem it solves

Every module configures `npgsql.EnableRetryOnFailure()`, which installs `NpgsqlRetryingExecutionStrategy`. As soon as any code opens a **user-initiated transaction** (`Database.BeginTransactionAsync`) while a retrying strategy is active, EF Core throws:

```
The configured execution strategy 'NpgsqlRetryingExecutionStrategy' does not support
user-initiated transactions. Use the execution strategy returned by
'DbContext.Database.CreateExecutionStrategy()' to execute all the operations in the
transaction as a retriable unit.
```

The fix is to wrap the whole transaction in `CreateExecutionStrategy().ExecuteAsync(...)`. This package provides that as extension methods so modules stop copy-pasting the boilerplate.

## Transaction helpers

```csharp
using BieberWorks.SDK.Core.Postgres;

// Commits on success, rolls back on exception. Safe with EnableRetryOnFailure().
await db.ExecuteInTransactionAsync(async ct =>
{
    db.Wallets.Update(wallet);
    await db.SaveChangesAsync(ct);
});

// Result-returning overload.
var balance = await db.ExecuteInTransactionAsync(async ct =>
{
    db.Wallets.Update(wallet);
    await db.SaveChangesAsync(ct);
    return wallet.Balance;
});

// Strategy retry WITHOUT an explicit transaction (single SaveChanges is already atomic).
var count = await db.ExecuteResilientlyAsync(ct => db.Items.CountAsync(ct));
```

The default isolation level is `ReadCommitted` (the PostgreSQL default). Pass a different level explicitly where stronger guarantees are needed (Wallet uses `RepeatableRead`).

## Publish domain events AFTER commit

The execution strategy retries the **entire delegate**. Any side effect inside it that is not part of the DB transaction (publishing domain events, sending emails, "created" logging) will run **multiple times** on retry.

Do DB work inside the delegate; perform side effects after the method returns:

```csharp
var (wallet, evt) = await db.ExecuteInTransactionAsync(async ct =>
{
    // DB work only
    db.Wallets.Update(wallet);
    await db.SaveChangesAsync(ct);
    return (wallet, new FundsCommittedEvent(wallet.Id, amount));
});

// Side effect only after a confirmed commit
await publisher.PublishAsync(evt);
```

## Optimistic-concurrency retry

For factory-based writers (e.g. Wallet uses `IDbContextFactory<WalletDbContext>`), `ExecuteWithConcurrencyRetryAsync` combines execution-strategy safety with a retry loop over `DbUpdateConcurrencyException`. Each attempt runs on a **fresh context** so stale tracked entities are discarded.

```csharp
var result = await dbFactory.ExecuteWithConcurrencyRetryAsync(async (db, ct) =>
{
    var wallet = await db.Wallets.FindAsync([id], ct);
    wallet!.Debit(amount);
    await db.SaveChangesAsync(ct);
    return wallet.Balance;
}, maxRetries: 3, isolationLevel: IsolationLevel.RepeatableRead);
```

The same "publish events after commit" rule applies: return events from the delegate and publish them after the call returns.

## Standard Npgsql registration

`AddBieberWorksNpgsql<TContext>` replaces the hand-written `AddDbContextFactory(... UseNpgsql(... EnableRetryOnFailure(); MigrationsHistoryTable(...)))` block in each module's `RegisterServices()`:

```csharp
services.AddBieberWorksNpgsql<WalletDbContext>(
    configuration,
    schema: "wallet",
    "WalletDb", "DefaultConnection"); // connection-string names, first non-empty wins
```

This registers an `IDbContextFactory<TContext>` with `EnableRetryOnFailure()` and a per-module migrations-history table (`__EFMigrationsHistory`) in the given schema.

## xmin optimistic-concurrency token (v0.10.0)

PostgreSQL automatically maintains the `xmin` system column on every row. Mapping it as a concurrency token lets EF Core detect conflicting concurrent updates without adding any extra column to your schema — no DDL is emitted, no migration column is generated.

### Explicit mapping (recommended)

Call `UseXminConcurrencyToken` inside your `IEntityTypeConfiguration<T>`:

```csharp
builder.UseXminConcurrencyToken(e => e.Version); // Version is a uint property
```

Works with any property name. Combine with `ExecuteWithConcurrencyRetryAsync` to transparently retry on conflict:

```csharp
var result = await dbFactory.ExecuteWithConcurrencyRetryAsync(async (db, ct) =>
{
    var item = await db.Items.FindAsync([id], ct);
    item!.Name = newName;
    await db.SaveChangesAsync(ct);
    return item;
});
```

### Convention mapping (opt-in)

Implement `IConcurrencyTracked` on your entity and call `ApplyXminConvention()` once in `OnModelCreating`:

```csharp
public sealed class Order : IConcurrencyTracked
{
    public int Id { get; set; }
    public uint Version { get; set; }   // mapped to xmin by convention
}

protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    modelBuilder.ApplyXminConvention();
}
```

`ApplyXminConvention` only touches entities that explicitly implement `IConcurrencyTracked`. It is never registered as a global always-on convention — call it explicitly to keep the behaviour predictable.

> **No DDL:** `xmin` is a system column. Regenerate your module migrations after wiring the token; the generated SQL will not contain any `xmin` DDL.

## Design-time factory base (v0.10.0)

Extend `BieberWorksDesignTimeFactory<TContext>` instead of writing a bespoke `IDesignTimeDbContextFactory` in each module. The base class reads `appsettings.json`, `appsettings.Development.json`, and environment variables from the current working directory, then resolves the connection string through the same ordered-name logic as `AddBieberWorksNpgsql<T>` — design-time and runtime always agree on which connection string is used.

```csharp
internal sealed class WalletDbContextFactory()
    : BieberWorksDesignTimeFactory<WalletDbContext>("wallet", "WalletDb", "DefaultConnection");
```

Override `ConfigureNpgsql` only when the context needs options beyond the BieberWorks standard (`EnableRetryOnFailure` + `MigrationsHistoryTable`).

> **Avoid `--no-build`:** EF tooling reads the compiled DLL to discover the factory. Using `--no-build` with a stale build generates migrations from the wrong model snapshot (duplicated or missing tables — see the `ef-migrations-no-build-trap` memory entry). Always run `dotnet ef migrations add <Name>` without `--no-build`, then review the generated SQL before applying.

## MigrateModuleAsync (v0.10.0)

Replaces the repeated `IDbContextFactory<T> → context.Database.MigrateAsync()` block in module startup:

```csharp
// In Program.cs / module initializer, after app.Build():
await app.Services.MigrateModuleAsync<WalletDbContext>();
```

Resolves `IDbContextFactory<TContext>` from the service provider, creates a context, and applies any pending migrations. Safe to call on every startup — `MigrateAsync` is a no-op when the schema is already up to date. Logs at `Information` level via `[LoggerMessage]` delegates.

## Transactional Outbox (v0.11.0)

The Outbox pattern guarantees at-least-once delivery of domain events **after** a local database commit. It is the correct tool for genuinely asynchronous or external effects (emails, notifications, webhooks) that must happen reliably but eventually after a business write.

> **Outbox ≠ distributed transaction.** An Outbox cannot roll back a write that has already committed in a different DbContext or process. For atomic cross-schema writes within a single Postgres instance (same database, different schemas), use a shared physical transaction across the participating DbContexts instead.

### Per-module outbox table

The outbox table lives in the **module's own schema**, registered in the module's own `DbContext`. This is mandatory: only when the outbox write happens inside the same `DbContext` as the business write can both participate in the same transaction.

Register the `OutboxMessage` entity in `OnModelCreating`:

```csharp
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    // ... other module mappings ...
    modelBuilder.AddOutbox("wallet");   // "wallet" is the module's schema
}
```

`AddOutbox` creates table `<schema>.outbox_messages` with a DB-generated `SEQUENCE` column, indexes for the claim query and retention cleanup, and a `Status` column for pending / processed / dead-lettered states.

After adding this call, generate a module migration:

```bash
dotnet ef migrations add AddOutbox --project src/Wallet
```

> **No `--no-build`:** always build first. See the [--no-build trap note](#design-time-factory-base-v0100).

### Enqueuing events

Use `ExecuteWithOutboxAsync` instead of `ExecuteInTransactionAsync` when you want to stage domain events that must be published after commit:

```csharp
await db.ExecuteWithOutboxAsync(async (outbox, ct) =>
{
    wallet.Debit(amount);
    db.Wallets.Update(wallet);
    outbox.Enqueue(new FundsDebitedEvent(wallet.Id, amount));
    await db.SaveChangesAsync(ct);
});
// The FundsDebitedEvent is persisted atomically with the wallet update.
// It will be published by the background dispatcher after this method returns.
```

The `IOutbox.Enqueue` method serializes the event to JSON and adds an `OutboxMessage` row to the change tracker. The row is committed (or rolled back) with the rest of the transaction.

### Event type identity (rename-safe)

The outbox stores each event's type discriminator in the `EventType` column so the dispatcher can deserialize pending and processed messages. By default, this discriminator is `Type.FullName` — which is invariant across assembly versions but sensitive to namespace or type renames.

For events whose fully-qualified name may change (e.g., domain restructuring), opt-in to a stable, permanently-fixed discriminator using the `[EventType("…")]` attribute from `BieberWorks.SDK.SharedKernel`:

```csharp
using BieberWorks.SDK.SharedKernel;

[EventType("wallet:funds:debited")]
public sealed record FundsDebitedEvent(Guid WalletId, decimal Amount) : IDomainEvent;
```

The format is a recommendation: lowercase, dot- or colon-separated domain slug (e.g. `"auth:user:registered"`, `"wallet:funds:held"`), globally unique within the outbox. This string is written once and never changes, so the event remains deserializable even after namespace reorganization, type renames, or assembly splits.

Existing persisted rows that carry the legacy assembly-qualified name are still deserialized transparently — no migration is required.

### Registering the dispatcher

Call `AddBieberWorksOutbox<TContext>()` in the module's `RegisterServices` (after `AddBieberWorksNpgsql`):

```csharp
services.AddBieberWorksOutbox<WalletDbContext>(options =>
{
    options.PollInterval  = TimeSpan.FromSeconds(10); // default
    options.BatchSize     = 50;                        // default
    options.MaxAttempts   = 10;                        // before dead-letter
    options.RetentionPeriod = TimeSpan.FromDays(7);   // cleanup processed rows
});
```

This registers `OutboxDispatcher<WalletDbContext>` as a `BackgroundService`. Multiple modules each register their own dispatcher; they are fully independent.

`IDomainEventPublisher` must be registered (Foundation's `AddBieberWorksMessaging()` does this).

#### Per-module options isolation

`OutboxOptions` are bound as **named options** keyed by `typeof(TContext).FullName`. Each dispatcher resolves only the options registered for its own `TContext` via `IOptionsMonitor<OutboxOptions>.Get(name)`. This means that in a modular monolith with many modules, every module configures its `BatchSize`, `MaxAttempts`, `PollInterval`, and `RetentionPeriod` independently without affecting other modules.

A consumer that does not provide a `configure` callback receives the built-in `OutboxOptions` defaults — no extra configuration is required to get started.

```csharp
// Module A: aggressive polling, small batches
services.AddBieberWorksOutbox<ForumDbContext>(opts =>
{
    opts.PollInterval = TimeSpan.FromSeconds(5);
    opts.BatchSize    = 20;
});

// Module B: relaxed polling, larger batches — completely independent
services.AddBieberWorksOutbox<WalletDbContext>(opts =>
{
    opts.PollInterval = TimeSpan.FromSeconds(30);
    opts.BatchSize    = 200;
});

// Module C: no customisation — uses OutboxOptions defaults
services.AddBieberWorksOutbox<NotificationsDbContext>();
```

### Delivery guarantees and idempotency

The dispatcher uses **at-least-once** delivery:

1. Fetch a batch of pending messages (ordered by `Sequence`).
2. For each message: deserialize the event, call `IDomainEventPublisher.PublishAsync`.
3. On success: mark as `Processed`, `SaveChanges`.
4. If step 3 fails after step 2 succeeded, the message is still `Pending` on the next poll and **will be published again**.

**Event handlers MUST be idempotent.** Use `OutboxMessage.Id` (a stable `Guid`) as the deduplication key. A typical handler pattern:

```csharp
// In the handler for FundsDebitedEvent:
if (await _idempotencyStore.AlreadyHandledAsync(eventId)) return;
await _idempotencyStore.MarkHandledAsync(eventId);
// ... actual handler logic ...
```

### Concurrent dispatch (FOR UPDATE SKIP LOCKED)

When multiple host instances run simultaneously, each dispatcher instance uses `FOR UPDATE SKIP LOCKED` on Postgres to claim a disjoint batch of rows. Two instances will never process the same message at the same time.

> **Coverage gap in tests:** The `SKIP LOCKED` path requires a live Postgres instance and is not covered by the SQLite-based unit tests in `Core.Postgres.Tests`. Use Testcontainers for integration testing of the concurrent-claim behaviour.

### Poison messages and dead-lettering

If a message fails every publish attempt up to `OutboxOptions.MaxAttempts`, it is marked `DeadLettered`. Dead-lettered messages:
- Are **never retried automatically**.
- Have `LastError` set to the exception text from the final attempt.
- Do not block subsequent messages in the same batch.

Query dead-lettered messages for inspection:

```csharp
var dead = await db.Set<OutboxMessage>()
    .Where(m => m.Status == OutboxMessageStatus.DeadLettered)
    .OrderBy(m => m.Sequence)
    .ToListAsync();
```

### Retention cleanup

The dispatcher performs a periodic cleanup that deletes `Processed` and `DeadLettered` rows whose `ProcessedOnUtc` is older than `OutboxOptions.RetentionPeriod` (default: 7 days). This runs automatically in the background poll loop alongside dispatch.

### When NOT to use the Outbox

| Scenario | Correct tool |
|---|---|
| Email after a confirmed booking | Outbox |
| Notification to another service after a write | Outbox |
| Deduct wallet + redeem voucher + update status (all in same Postgres DB) | Shared physical transaction across DbContexts (one EF `DbConnection` / `DbTransaction` shared across scoped contexts) |
| Rolling back a foreign module's already-committed write | Not possible — redesign the flow |

The "shared physical transaction" helper for the local cross-schema case is a candidate for a future `Core.Postgres` addition; raise a request if your module needs it.

## Scope

- PostgreSQL/Npgsql only — does not reference ASP.NET Core.
- No `DbContext` base class, no repository abstractions (those live in `SharedKernel`).
- Does not own domain-event publishing — it documents the "publish after commit" rule but the publisher stays in `Core` messaging.
