# Changelog

## Unreleased

### Fixed
- `StorageSettings` singleton enforcement was incomplete: `StorageSettingsConfiguration` now adds a
  PostgreSQL check constraint (`CK_storage_settings_SingletonId`) that rejects any row whose `Id`
  differs from the well-known Guid `00000000-0000-0000-0000-000000000001`, and seeds that row via
  `HasData` so the table is always in a valid state after migration.
  Migration: `AddStorageSettingsSingletonConstraint` — the `Up` path uses an idempotent SQL upsert
  (`INSERT … ON CONFLICT DO NOTHING`) before adding the constraint, so existing deployments that
  already contain the well-known row are not affected. Deployments with zero rows or with the
  well-known row are fully covered; a row with a different primary key (should never occur in
  practice) is re-keyed to the well-known Guid before the constraint is applied.

### Added (docs)
- `ui-components.md`: "Uploading from feature modules" section expanded with a complete, compilable
  `MudFileUpload`-based Pattern A example (feature module builds its own upload UI against
  `IStorageService` from `Storage.Contracts`); Pattern B (host-composed `RenderFragment` slot)
  updated with a two-component example. Both patterns reference the `IStorageService.UploadAsync`
  signature exactly.

## v0.9.2 (2026-06-21)

### Added
- English documentation added to module repository (v0.1.1 content merged into release history)
