# Changelog

## next (unreleased)

### Added

- **Recurring expired-holds sweeper** (`ExpiredHoldsSweeper`): a background service that periodically calls `IWalletService.ReleaseExpiredHoldsAsync` so expired holds are released even on long-running hosts without a restart. Enabled by default (`WalletOptions.ExpiredHoldsSweepEnabled = true`). Interval configurable via `WalletOptions.ExpiredHoldsSweepInterval` (default: 5 minutes). A tick exception is logged and the loop continues — one transient error does not stop the sweeper.
- **`WalletOptions`**: new configuration class bound from the `"Wallet"` configuration section. Exposes `ExpiredHoldsSweepEnabled` and `ExpiredHoldsSweepInterval`.
