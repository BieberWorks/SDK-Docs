# Wallet

The Wallet module provides a multi-currency, permission-gated balance system for BieberWorks SDK hosts. It supports credit/debit operations, fund holds with automatic expiry, server-side paged transaction history, an ISO 4217 currency catalog with admin-managed active currencies, and full GDPR erasure support.

## What the module offers

- **Balance management** — top-up (admin/programmatic), debit, and manual adjustment operations with optimistic concurrency retry
- **Hold / Reserve pattern** — create, commit, and release fund holds; configurable expiry via SDK-Settings
- **Recurring expired-holds sweeper** — background service cleans up expired holds automatically (configurable interval, opt-out)
- **ISO 4217 currency catalog** — ~170 currencies embedded as a static dictionary; active currencies managed via Admin UI at `/admin/wallet/currencies`
- **Server-side paged transaction history** — `WalletPagedResult<T>` keeps memory usage flat for large histories; MudBlazor grids use `MudDataGrid.ServerData`
- **Permission-gated UI** — Account pages under `/account/wallet/*` (requires `wallet:balance:view`); Admin pages under `/admin/wallet/*` (requires `wallet:admin:manage`)
- **Auto-auditing** — all write operations publish an `IAuditableEvent`; SDK-Audit logs them without any module-level audit code
- **GDPR** — export, anonymise-always erasure, and impact assessment (warning on wallet data; blocker on active holds)
- **NullWalletService** — allows consumer modules to declare an optional dependency on Wallet without forcing hosts to install it
- **IWalletTopUpProvider** — extension point for external payment providers (Stripe, PayPal, etc.); no built-in self-service top-up endpoint

## Package overview

| Package | Description | When needed |
|---|---|---|
| `BieberWorks.SDK.Wallet.Contracts` | Interfaces, DTOs, domain events, permission constants, `Iso4217Catalog`, `NullWalletService` | Always when another module consumes Wallet services |
| `BieberWorks.SDK.Wallet` | Complete implementation: EF Core (`WalletDbContext`, schema `wallet`), service layer, Minimal API endpoints, GDPR handlers, `ExpiredHoldsSweeper` | In the host providing the Wallet feature |
| `BieberWorks.SDK.Wallet.UI.MudBlazor` | Ready-made MudBlazor Razor components and pages for admin and account areas | When using the built-in Wallet pages |

## When to use which package

| Scenario | Required packages |
|---|---|
| Another module calls `IWalletService` or `IWalletCurrencyService` | `Wallet.Contracts` |
| Host provides the Wallet feature | `Wallet` + optional `Wallet.UI.MudBlazor` |
| Host without Wallet (optional dependency) | Register `NullWalletService` via `TryAddScoped<IWalletService, NullWalletService>()` |
| Host with external payment top-up flow | Implement and register `IWalletTopUpProvider` in the host |

## Documentation

| Topic | Document |
|---|---|
| Installation, `Program.cs`, connection string, permissions setup, `NullWalletService` | [Getting Started](getting-started.md) |
| `IWalletService` methods, hold/release lifecycle, `WalletOptions`, sweeper configuration | [Wallet Service API](wallet-service.md) |
| ISO 4217 catalog, `IWalletCurrencyService`, currency rules, admin UI | [Currencies](currencies.md) |
| Permission constants, assignment, REST endpoint protection | [Permissions](permissions.md) |
| GDPR export, anonymise-always erasure, impact assessment (holds blocker) | [GDPR / Privacy](gdpr-privacy.md) |
| Release history | [Changelog](CHANGES.md) |
