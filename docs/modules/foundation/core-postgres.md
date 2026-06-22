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

## Scope

- PostgreSQL/Npgsql only — does not reference ASP.NET Core.
- No `DbContext` base class, no repository abstractions (those live in `SharedKernel`).
- Does not own domain-event publishing — it documents the "publish after commit" rule but the publisher stays in `Core` messaging.
- No migration runner replacement — `InitializeBieberWorksModulesAsync()` stays as-is.
