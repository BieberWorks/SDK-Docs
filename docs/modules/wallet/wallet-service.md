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

Batch-Release aller abgelaufenen Holds. Wird automatisch beim Modulstart (`InitializeAsync`) aufgerufen.

### GetTransactionsAsync / GetActiveHoldsAsync

```csharp
Task<WalletPagedResult<WalletTransactionDto>> GetTransactionsAsync(
    WalletTransactionFilter filter, CancellationToken ct = default);
Task<IReadOnlyList<WalletHoldDto>> GetActiveHoldsAsync(string userId, CancellationToken ct = default);
```

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

SDK-Audit loggt alle Events automatisch — kein Audit-Code im Wallet-Modul nötig.
