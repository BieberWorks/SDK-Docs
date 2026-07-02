# IWalletService — API Reference

## Namespace

`BieberWorks.SDK.Wallet.Contracts.Interfaces`

`IWalletService` is segregated into `IWalletReader` (balance/transaction/hold reads),
`IWalletWriter` (money-moving writes: top-up, debit, adjust, hold lifecycle) and `IWalletAdmin`
(administrative operations). `IWalletService` inherits all three, and each segregated interface
is registered in DI against the same `WalletService` instance, so a consumer can inject the
narrow interface it needs.

A wallet is identified by `(UserId, CurrencyCode)` — each user has one wallet per currency, and
amounts in different currencies never mix.

## Methods

### GetOrCreateAsync

```csharp
Task<WalletDto> GetOrCreateAsync(string userId, string currencyCode = "EUR", CancellationToken ct = default);
```

Creates a wallet if none exists (idempotent). Always returns a `WalletDto`.

### GetAvailableBalanceAsync

```csharp
Task<decimal> GetAvailableBalanceAsync(string userId, string currencyCode = "EUR", CancellationToken ct = default);
```

Returns the available balance (`Balance` minus `HeldAmount`) for the user's wallet in the given currency.

### TopUpAsync / DebitAsync / AdjustAsync

```csharp
Task<Result<WalletTransactionDto>> TopUpAsync(string userId, decimal amount, string currencyCode = "EUR",
    string? reference = null, string? description = null, CancellationToken ct = default);

Task<Result<WalletTransactionDto>> DebitAsync(string userId, decimal amount, string currencyCode = "EUR",
    string? reference = null, string? description = null, CancellationToken ct = default);

Task<Result<WalletTransactionDto>> AdjustAsync(string userId, decimal amount, string currencyCode = "EUR",
    string? reason = null, string? adjustedByUserId = null, CancellationToken ct = default);
```

- `TopUpAsync` is intended for admin-initiated and programmatic (consumer module) top-ups only. There is no self-service top-up endpoint. Hosts that require an online payment flow use the two-phase provider top-up below (`InitiateTopUpAsync` / `ConfirmTopUpAsync`) backed by an `IWalletTopUpProvider`.
- `DebitAsync` returns `Result.Failure("wallet:insufficient_balance")` when the balance is too low.
- `AdjustAsync` can carry a negative amount (balance is reduced, floor = 0).
- All write operations run inside a `RepeatableRead` transaction via `Core.Postgres` (`ExecuteWithConcurrencyRetryAsync`) with up to 3 retries on `DbUpdateConcurrencyException`. The transaction is execution-strategy-safe (compatible with `EnableRetryOnFailure`); domain events are published only **after** commit.

### InitiateTopUpAsync / ConfirmTopUpAsync (two-phase provider top-up)

```csharp
Task<Result<TopUpSessionDto>> InitiateTopUpAsync(string userId, decimal amount, string currencyCode,
    string providerKey, string returnUrl, CancellationToken ct = default);

Task<Result<WalletTransactionDto>> ConfirmTopUpAsync(string providerReference, CancellationToken ct = default);
```

Online payment top-ups run in two phases and **never** credit the wallet from client input:

- `InitiateTopUpAsync` selects the registered `IWalletTopUpProvider` by `providerKey`, asks it to start a payment session, and persists a *pending* record. **No balance is changed** — it returns the provider session (e.g. a redirect URL) for the host to drive the payment.
- `ConfirmTopUpAsync` is called once the provider reports completion. The service calls `IWalletTopUpProvider.VerifyAsync`, and credits the wallet using the **provider-verified** amount and currency — not the amount originally requested by the client. The operation is idempotent (a second confirm of the same `providerReference` returns the original transaction without re-crediting), and the credit + idempotency marker are committed atomically under the wallet's `xmin` concurrency token.

### Hold concept

A **hold** reserves funds without booking them:

```
Balance -= Amount          → funds are no longer available
HeldAmount += Amount       → reservation created
```

On **commit**:
```
HeldAmount -= Amount       → reservation resolved
Debit transaction created  → booking appears in history
```

On **release**:
```
Balance += Amount          → funds available again
HeldAmount -= Amount       → reservation resolved
```

### HoldAsync

```csharp
Task<Result<WalletHoldDto>> HoldAsync(string userId, decimal amount, string currencyCode = "EUR",
    string? reference = null, CancellationToken ct = default);
```

Expiry is read from `ISettingsService.GetValue("Wallet:HoldTimeInMinutes", "30")`.

- `30` → hold expires in 30 minutes.
- `0` → hold **never** expires automatically (`ExpiresAt = null`).

### CommitHoldAsync / ReleaseHoldAsync

```csharp
Task<Result<WalletTransactionDto>> CommitHoldAsync(Guid holdId, CancellationToken ct = default);
Task<Result> ReleaseHoldAsync(Guid holdId, CancellationToken ct = default);
```

Both return `Result.Failure("wallet:hold_not_found")` when the hold is unknown or already released.

### ReleaseExpiredHoldsAsync

```csharp
Task<int> ReleaseExpiredHoldsAsync(CancellationToken ct = default);
```

Batch-releases all expired holds (where `ExpiresAt < UtcNow`). Returns the number of holds released.

Called automatically at module startup (`InitializeAsync`) for an immediate cleanup pass.
Also called periodically by the **recurring expired-holds sweeper** (see below).

### GetTransactionsAsync / GetActiveHoldsAsync

```csharp
Task<PagedResult<WalletTransactionDto>> GetTransactionsAsync(
    WalletTransactionFilter filter, CancellationToken ct = default);
Task<IReadOnlyList<WalletHoldDto>> GetActiveHoldsAsync(string userId, CancellationToken ct = default);
```

`GetTransactionsAsync` is **server-side paged**: the query applies `Skip((Page - 1) * PageSize).Take(PageSize)`
and returns the canonical `BieberWorks.SDK.SharedKernel.PagedResult<T>` carrying `Total` alongside the current page's items — only the
requested page is materialized, never the full history. The MudBlazor admin and account transaction grids
drive this through `MudDataGrid.ServerData` with a `MudDataGridPager` (page navigation + selectable page
size), so large histories are never loaded or rendered all at once.

## Events (Auto-Auditing)

All write operations publish an `IAuditableEvent`:

| Operation | Event |
|---|---|
| `TopUpAsync` | `WalletToppedUpEvent` |
| `DebitAsync` | `WalletDebitedEvent` |
| `AdjustAsync` | `WalletAdjustedEvent` |
| `HoldAsync` | `WalletHoldCreatedEvent` |
| `CommitHoldAsync` | `WalletHoldCommittedEvent` |
| `ReleaseHoldAsync` | `WalletHoldReleasedEvent` |

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
- **Startup pass preserved.** `WalletModule.InitializeAsync` still calls `ReleaseExpiredHoldsAsync` once at boot; the sweeper handles recurring runs thereafter.
- **Resilient loop.** An exception in one tick is logged at `Error` level and the sweeper continues. A single transient DB error never kills the background service.
- **Scoped lifetime.** Each tick creates a new DI scope and resolves `IWalletService` inside it, correctly handling the singleton-hosted-service / scoped-service lifetime boundary.
- **Disable** by setting `ExpiredHoldsSweepEnabled: false` — for example when an external scheduler (cron job, Hangfire, etc.) already invokes `ReleaseExpiredHoldsAsync` on its own cadence, or when running a dedicated worker instance that should not sweep.

---

## IWalletTopUpProvider

Hosts that need an external payment flow (Stripe, PayPal, etc.) implement this contract and register it in DI. The Wallet module has no built-in self-service top-up UI or endpoint — the provider abstraction is the extension point for Phase 5.

```csharp
// Namespace: BieberWorks.SDK.Wallet.Contracts.Interfaces
public interface IWalletTopUpProvider
{
    string ProviderKey { get; }

    // Phase 1: start a payment session. Must NOT credit anything.
    Task<Result<TopUpInitiationResult>> InitiateAsync(
        string userId, decimal amount, string currencyCode,
        string returnUrl, CancellationToken ct = default);

    // Phase 2: verify a completed payment. Returns the provider-verified amount/currency;
    // the Wallet service performs the actual credit based on this verified result.
    Task<Result<TopUpConfirmationResult>> VerifyAsync(
        string providerReference, CancellationToken ct = default);
}
```

The provider only *initiates* and *verifies*; it never mutates the wallet balance itself. Crediting is centralised in `WalletService.ConfirmTopUpAsync` so the idempotency and concurrency guarantees apply uniformly across all providers.
