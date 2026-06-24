# IWalletService — API Reference

## Namespace

`BieberWorks.SDK.Wallet.Contracts.Interfaces`

## Methoden

### GetOrCreateAsync

```csharp
Task<WalletDto> GetOrCreateAsync(string userId, string currencyCode = "EUR", CancellationToken ct = default);
```

Erstellt eine Wallet wenn keine existiert (idempotent). Gibt immer eine `WalletDto` zurück.

### GetAvailableBalanceAsync

```csharp
Task<decimal> GetAvailableBalanceAsync(string userId, CancellationToken ct = default);
```

Gibt das verfügbare Guthaben zurück (`Balance`, ohne `HeldAmount`).

### TopUpAsync / DebitAsync / AdjustAsync

```csharp
Task<Result<WalletTransactionDto>> TopUpAsync(string userId, decimal amount, string currencyCode = "EUR",
    string? reference = null, string? description = null, CancellationToken ct = default);

Task<Result<WalletTransactionDto>> DebitAsync(...);
Task<Result<WalletTransactionDto>> AdjustAsync(string userId, decimal amount, string currencyCode = "EUR",
    string? reason = null, string? adjustedByUserId = null, CancellationToken ct = default);
```

- `DebitAsync` gibt `Result.Failure("wallet:insufficient_balance")` wenn Guthaben nicht ausreicht.
- `AdjustAsync` kann negativ sein (Betrag wird vom Saldo abgezogen, Floor = 0).
- Alle Operationen laufen unter einer `RepeatableRead`-Transaktion via `Core.Postgres` (`ExecuteWithConcurrencyRetryAsync`) mit bis zu 3 Retry bei `DbUpdateConcurrencyException`. Die Transaktion ist execution-strategy-safe (kompatibel mit `EnableRetryOnFailure`); Domain-Events werden erst NACH dem Commit publiziert.

### Hold-Konzept

Ein **Hold** reserviert Guthaben, ohne es zu buchen:

```
Balance -= Amount          → Guthaben sinkt (nicht mehr verfügbar)
HeldAmount += Amount       → Reservierung angelegt
```

Bei **Commit**:
```
HeldAmount -= Amount       → Reservierung aufgelöst
Debit-Transaktion erzeugt  → Buchung erscheint in Historie
```

Bei **Release**:
```
Balance += Amount          → Guthaben wieder verfügbar
HeldAmount -= Amount       → Reservierung aufgelöst
```

### HoldAsync

```csharp
Task<Result<WalletHoldDto>> HoldAsync(string userId, decimal amount, string currencyCode = "EUR",
    string? reference = null, CancellationToken ct = default);
```

Ablaufzeit: aus `ISettingsService.GetValue("Wallet:HoldTimeInMinutes", "30")`.
- `30` → Hold läuft in 30 Minuten ab.
- `0` → Hold läuft NIEMALS automatisch ab (`ExpiresAt = null`).

### CommitHoldAsync / ReleaseHoldAsync

```csharp
Task<Result<WalletTransactionDto>> CommitHoldAsync(Guid holdId, CancellationToken ct = default);
Task<Result> ReleaseHoldAsync(Guid holdId, CancellationToken ct = default);
```

Beide geben `Result.Failure("wallet:hold_not_found")` wenn der Hold unbekannt oder bereits released ist.

### ReleaseExpiredHoldsAsync

```csharp
Task<int> ReleaseExpiredHoldsAsync(CancellationToken ct = default);
```

Batch-releases all expired holds (where `ExpiresAt < UtcNow`). Returns the number of holds released.

Called automatically at module startup (`InitializeAsync`) for an immediate cleanup pass.
Also called periodically by the **recurring expired-holds sweeper** (see below).

### GetTransactionsAsync / GetActiveHoldsAsync

```csharp
Task<WalletPagedResult<WalletTransactionDto>> GetTransactionsAsync(
    WalletTransactionFilter filter, CancellationToken ct = default);
Task<IReadOnlyList<WalletHoldDto>> GetActiveHoldsAsync(string userId, CancellationToken ct = default);
```

`GetTransactionsAsync` is **server-side paged**: the query applies `Skip((Page - 1) * PageSize).Take(PageSize)`
and returns a `WalletPagedResult<T>` carrying `TotalCount` alongside the current page's items — only the
requested page is materialized, never the full history. The MudBlazor admin and account transaction grids
drive this through `MudDataGrid.ServerData` with a `MudDataGridPager` (page navigation + selectable page
size), so large histories are never loaded or rendered all at once.

## Events (Auto-Auditing)

Alle schreibenden Operationen publizieren ein `IAuditableEvent`:

| Operation | Event |
|---|---|
| TopUpAsync | `WalletToppedUpEvent` |
| DebitAsync | `WalletDebitedEvent` |
| AdjustAsync | `WalletAdjustedEvent` |
| HoldAsync | `WalletHoldCreatedEvent` |
| CommitHoldAsync | `WalletHoldCommittedEvent` |
| ReleaseHoldAsync | `WalletHoldReleasedEvent` |

SDK-Audit logs all events automatically — no audit code is required in the Wallet module.

---

## Recurring Expired-Holds Sweeper

`BieberWorks.SDK.Wallet` ships a background service (`ExpiredHoldsSweeper`) that calls
`ReleaseExpiredHoldsAsync` on a regular schedule so expired holds are cleaned up even when the
host runs for a long time between restarts.

### Configuration (`WalletOptions`)

Bind from the `"Wallet"` section of your configuration:

```json
{
  "Wallet": {
    "ExpiredHoldsSweepEnabled": true,
    "ExpiredHoldsSweepInterval": "00:05:00"
  }
}
```

| Property | Type | Default | Description |
|---|---|---|---|
| `ExpiredHoldsSweepEnabled` | `bool` | `true` | Enables the background sweeper. |
| `ExpiredHoldsSweepInterval` | `TimeSpan` | `00:05:00` | How often the sweep runs. |

### Behaviour

- **Enabled by default.** The safe behaviour (periodic cleanup) is opt-out, not opt-in.
- **Startup pass preserved.** `WalletModule.InitializeAsync` still calls `ReleaseExpiredHoldsAsync`
  once at boot; the sweeper handles recurring runs thereafter.
- **Resilient loop.** An exception in one tick is logged at `Error` level and the sweeper continues.
  A single transient DB error never kills the background service.
- **Scoped lifetime.** Each tick creates a new DI scope and resolves `IWalletService` inside it,
  correctly handling the singleton-hosted-service / scoped-service lifetime boundary.
- **Disable** by setting `ExpiredHoldsSweepEnabled: false` — for example when an external
  scheduler (cron job, Hangfire, etc.) already invokes `ReleaseExpiredHoldsAsync` on its own cadence,
  or when running a dedicated worker instance that should not sweep.
