# GDPR / Privacy — SDK-Wallet

The Wallet module implements the three SharedKernel GDPR contracts
(`IUserDataExporter`, `IUserDataEraser`, `IUserDataErasureImpactProvider`)
under `Features/Privacy`. All three are registered via `TryAddEnumerable` in
`WalletModule` so they participate in the platform-wide erasure pipeline
orchestrated by SharedKernel without any additional host-side wiring.

For an explanation of the contracts themselves and how the orchestration pipeline
works, see the SharedKernel documentation.

---

## Data covered

| Entity | Table | Exported | Erased |
|---|---|---|---|
| Wallet | `wallet.wallets` | Yes | Yes (anonymised) |
| Transactions | `wallet.transactions` | Yes | Yes (anonymised) |
| Holds | `wallet.holds` | Yes | Yes (anonymised) |

---

## Export (`WalletUserDataExporter`)

Returns a `UserDataExport` with module name `BieberWorks.SDK.Wallet` and a
single JSON payload containing three top-level keys: `wallet`, `transactions`,
and `holds`.

**Exported fields per entity:**

- **Wallet** — `id`, `userId`, `currencyCode`, `balance`, `heldAmount`,
  `createdAt`, `updatedAt`
- **Transactions** — `id`, `walletId`, `userId`, `type`, `amount`,
  `currencyCode`, `reference`, `description`, `createdAt`
- **Holds** — `id`, `walletId`, `userId`, `amount`, `currencyCode`,
  `reference`, `expiresAt`, `createdAt`, `isReleased`

Transactions are ordered by `createdAt` ascending; holds likewise. If the user
has no wallet, all three arrays are empty. The payload uses `JsonSerializerOptions.Web`
(camelCase, relaxed numbers).

---

## Erasure (`WalletUserDataEraser`)

**Strategy: Anonymise — always.**

Financial records (transactions, holds, wallet balances) are subject to
commercial and tax retention obligations. Permanent deletion is therefore not
permissible. The eraser **ignores the requested `ErasureMode`**: both
`ErasureMode.HardDelete` and `ErasureMode.Anonymize` are treated as anonymise.

The `UserId` column is overwritten with the tombstone value `"ERASED"` on every
affected row across all three tables. Rows already carrying the tombstone are
excluded by the `WHERE userId = <realId>` filter, making the operation fully
idempotent.

**`UserErasureResult` fields after a successful run:**

| Field | Value |
|---|---|
| `ModuleName` | `BieberWorks.SDK.Wallet` |
| `Affected` | Number of rows updated (wallets + transactions + holds) |
| `Retained` | Equal to `Affected` (all rows kept, none deleted) |
| `RetainedReason` | `"financial record retention"` (or `null` if `Affected == 0`) |

EF change-tracking is used rather than bulk-`ExecuteUpdate` so the
implementation is compatible with both the EF InMemory provider (unit tests)
and Npgsql (production).

---

## Impact assessment (`WalletErasureImpactProvider`)

Returns `null` when the user has no wallet at all. Otherwise returns a
`UserErasureImpact` with one or two items:

### Always present when wallet exists

| Severity | Message |
|---|---|
| `Warning` | `"Wallet balance and transaction history will be anonymised (financial record retention applies)."` |

This warning informs operators that the user's financial data will persist in
anonymised form rather than being permanently deleted.

### Additional item when active holds exist

| Severity | Message |
|---|---|
| `Blocker` | `"User has N active hold(s) — erasure should be deferred until all holds are released or expired."` |

A hold is considered active when `IsReleased == false`. An unreleased hold
represents a live financial reservation; the orchestration layer treats a
`Blocker` item as a hard-stop that prevents the erasure from proceeding until
the operator resolves the underlying situation (release or expire the holds).

---

## Logging

| Logger class | Level | When |
|---|---|---|
| `WalletUserDataEraser` | `Information` | After each successful anonymisation; counts per table |
| `WalletErasureImpactProvider` | `Debug` | When wallet data is present; reports active hold count |
