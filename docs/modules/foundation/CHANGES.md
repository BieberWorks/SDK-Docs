# Changelog

## next (unreleased)

### Changed
- `ISingletonEntity` — reduced to a member-less marker interface (removed `int Id` member). The entity's primary key is provided by `EntityBase` (`Guid Id`); declaring an `int Id` on the marker conflicted with the Guid-based key and had zero SDK consumers. The singleton row is now identified by a well-known `Guid` constant in the implementing entity. This is technically a breaking change to the interface signature, but with no existing implementations across the SDK it is safe in practice. The EF Core snippet in `shared-kernel.md` is updated accordingly (Guid-based check constraint instead of `Id = 1`).

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
