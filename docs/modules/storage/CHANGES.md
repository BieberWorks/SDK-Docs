# Changelog

## next (unreleased)

### Added

- `PublicFileImageEndpointExtensions.MapPublicFileImage` — registers an unauthenticated
  GET endpoint that resolves a file id via a caller-supplied delegate, streams the file
  via `IStorageService.DownloadAsync`, and writes `ETag`, `Last-Modified`,
  `Cache-Control` response headers. Supports `If-None-Match` → 304 and
  `If-Modified-Since` → 304 conditional-request handling. Cache max-age is configurable
  (default 1 hour).
- `StorageFileUrl.TryParseStorageFileUrl` — parses the `/storage/files/{guid}` URL
  convention into a `Guid` file id.
- `docs/public-image-endpoint.md` — usage guide including registration, cache-header
  behaviour, and security guidance on GUID-based capability URLs.

## Unreleased

### Fixed
- `BwFilePreview`: removed `MudPaper` wrapper — component now renders a plain `<div>` without background, padding, or elevation. `Elevation` parameter removed. `Class`, `Style`, and `MinHeight` parameters remain and are applied to the root element. Wrap with `MudPaper`/`MudCard` yourself if needed.
- `FileDetailView`: removed `MudPaper` wrapper from the preview panel for the same reason.

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
