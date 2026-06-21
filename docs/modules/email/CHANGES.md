# Changelog

## v0.9.0 (2026-06-21)

### Added
- `EmailRateLimitOptions` — opt-in rate-limit configuration (`Email:RateLimit` section).
- `EmailRateLimitExceededException` — thrown when a limit is exceeded; carries `EmailRateLimitKind` discriminator (`GlobalPerMinute`, `GlobalPerHour`, `PerRecipientPerHour`).
- `RateLimitedEmailSender` — decorator for `IEmailSender`, active only when at least one limit is non-zero. Uses `IMemoryCache` for counters. All throttling events are logged via `[LoggerMessage]` delegates without PII.
- `EmailModule` automatically wraps the registered sender in the decorator when rate-limit options are present; no consumer-side wiring required.

## v0.0.5 (2026-06-18)

### Added
- English documentation added to module repository
