# SDK-Wallet

The **SDK-Wallet** module provides a ledger-backed wallet system for BieberWorks SDK applications — multi-currency balances, hold/commit/release transactions, and an embedded ISO-4217 currency catalogue.

## Packages

| Package | Purpose | Version |
|---|---|---|
| `BieberWorks.SDK.Wallet.Contracts` | Interfaces, DTOs, Events, Permissions — reference this in consumer modules | ![v1.0.0](https://img.shields.io/badge/version-1.0.0-blue) |
| `BieberWorks.SDK.Wallet` | Core implementation, `WalletDbContext` (schema `wallet`), REST endpoints | ![v1.0.0](https://img.shields.io/badge/version-1.0.0-blue) |
| `BieberWorks.SDK.Wallet.UI.MudBlazor` | Admin UI (`/admin/wallet/*`) + Account UI (`/account/wallet/*`), permission-gated | ![v1.0.0](https://img.shields.io/badge/version-1.0.0-blue) |

::: tip Current version
All packages are released together. Current stable version: **v1.0.0**.
:::

## Key Capabilities

- **Multi-currency balances** — per-user wallet per ISO-4217 currency code
- **Hold / Commit / Release** — two-phase reservation pattern for safe deductions
- **Concurrency-safe** — optimistic concurrency with automatic retry via `ConcurrencyRetry`
- **Embedded ISO-4217 catalogue** — no external dependency for currency metadata
- **Auto-Auditing** — wallet operations implement `IAuditableEvent`; zero audit boilerplate
- **NullWalletService** — optional fallback for hosts that don't include the wallet

## Database

Own `WalletDbContext` under PostgreSQL schema `wallet`. Migrations run automatically via `InitializeBieberWorksModulesAsync()`.

Connection string lookup order: `WalletDb` → `DefaultConnection`.

## Further Reading

- [Getting Started](./getting-started) — installation, Program.cs, connection string
- [IWalletService](./wallet-service) — full API reference
- [Currencies](./currencies) — ISO-4217 catalogue usage
- [Permissions](./permissions) — permission keys and role assignment
