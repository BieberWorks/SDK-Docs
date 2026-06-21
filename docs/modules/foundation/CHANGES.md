# Changelog

## next (unreleased)

### Added
- `LocalizedText` — immutable, culture-open in-memory value object in `BieberWorks.SDK.SharedKernel.Localization`. Three-tier fallback (exact → language-only → prefix-scan → first available). No EF Core dependency; persistence strategy is the consumer's responsibility.
- `ISingletonEntity` — POCO marker interface in `BieberWorks.SDK.SharedKernel` for the Id=1 singleton-entity pattern. EF Core check-constraint snippet documented in `shared-kernel.md`.

## v0.3.0 (2026-06-18)

### Changed
- Translated documentation to English

## v0.3.0 — Foundation docs (2026-06-18)

### Added
- index.md — module overview
- shared-kernel.md — SharedKernel types reference
- messaging.md — Messaging system guide
