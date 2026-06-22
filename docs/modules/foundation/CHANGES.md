# Changelog

## next (unreleased)

### Changed
- `OutboxOptions` are now bound as **named options** keyed by `typeof(TContext).FullName`. Each `OutboxDispatcher<TContext>` resolves its own independently configured options via `IOptionsMonitor<OutboxOptions>.Get(name)`. In a modular monolith with multiple modules, every module can set `BatchSize`, `MaxAttempts`, `PollInterval`, and `RetentionPeriod` independently. Consumers that do not pass a `configure` callback receive the built-in defaults — no migration required. `AddBieberWorksOutbox<TContext>` signature is unchanged.
- `ISingletonEntity` — reduced to a member-less marker interface (removed `int Id` member). The entity's primary key is provided by `EntityBase` (`Guid Id`); declaring an `int Id` on the marker conflicted with the Guid-based key and had zero SDK consumers. The singleton row is now identified by a well-known `Guid` constant in the implementing entity. This is technically a breaking change to the interface signature, but with no existing implementations across the SDK it is safe in practice. The EF Core snippet in `shared-kernel.md` is updated accordingly (Guid-based check constraint instead of `Id = 1`).

### Added (Core.Postgres)
- Optimistic concurrency (xmin): `IConcurrencyTracked` marker interface, `UseXminConcurrencyToken<TEntity>()` builder extension (explicit, recommended) and opt-in `ApplyXminConvention()` model-builder extension. Removes the per-entity `xmin`/`xid`/`IsRowVersion` mapping boilerplate so `ExecuteWithConcurrencyRetryAsync` works out of the box.
- Design-time support: `BieberWorksDesignTimeFactory<TContext>` base class and `MigrateModuleAsync<TContext>()` service-provider extension. Connection-string resolution is shared with the runtime registration so design-time configuration cannot drift from runtime.
- Transactional outbox: `IOutbox.Enqueue`, `ExecuteWithOutboxAsync` DbContext extension, `OutboxMessage` entity with per-module-DbContext registration (`AddOutbox()`), and a hosted `IOutboxDispatcher` (`AddBieberWorksOutbox`) that publishes stored domain events at-least-once after commit (`FOR UPDATE SKIP LOCKED` claim, retry/backoff, dead-letter, retention). Handlers must be idempotent. Documented as not a distributed-transaction substitute.

### Added (previous unreleased)
- `LocalizedText` — immutable, culture-open in-memory value object in `BieberWorks.SDK.SharedKernel.Localization`. Three-tier fallback (exact → language-only → prefix-scan → first available). No EF Core dependency; persistence strategy is the consumer's responsibility.
- `ISingletonEntity` — introduced as POCO marker interface in `BieberWorks.SDK.SharedKernel` for the singleton-entity pattern. EF Core check-constraint snippet documented in `shared-kernel.md`.

## v0.3.0 (2026-06-18)

### Changed
- Translated documentation to English

## v0.3.0 — Foundation docs (2026-06-18)

### Added
- index.md — module overview
- shared-kernel.md — SharedKernel types reference
- messaging.md — Messaging system guide
