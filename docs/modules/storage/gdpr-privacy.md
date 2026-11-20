# GDPR / Privacy — SDK-Storage

The Storage module implements the three SharedKernel GDPR contracts
(`IUserDataExporter`, `IUserDataEraser`, `IUserDataErasureImpactProvider`)
under `Features/Privacy`. All three are registered via `TryAddEnumerable` in
`StorageModule` and participate in the platform-wide erasure pipeline
orchestrated by SharedKernel without any additional host-side wiring.

For an explanation of the contracts themselves and how the orchestration pipeline
works, see the SharedKernel documentation.

---

## Data covered

| Entity | Table | Exported | Erased |
|---|---|---|---|
| File metadata | `storage.storage_files` | Yes (metadata only) | Yes (hard delete) |
| Physical blobs | Provider-specific | No | Yes (best-effort via `IFileStorage`) |
| Blob bytes (DB-Blob provider) | `storage.file_blobs` | No | Yes (cascade via FK) |

---

## Export (`StorageUserDataExporter`)

Returns a `UserDataExport` with module name `BieberWorks.SDK.Storage` and a
JSON payload with a single top-level key `files` — an array ordered by
`createdAt` ascending.

**Exported fields per file:**

`id`, `fileName`, `sizeBytes`, `contentType`, `visibility`, `createdAt`

Blob contents are intentionally **not** included in the export. The export
covers metadata only, giving the user a record of what files they own without
streaming potentially large binary payloads through the GDPR pipeline.

If `userId` is not a valid GUID the export returns an empty `files` array
immediately. If the user has no files the array is likewise empty. The payload
uses `JsonSerializerOptions.Web` (camelCase).

---

## Erasure (`StorageUserDataEraser`)

**Strategy: Hard delete — always, with provider-level blob removal.**

Storage files have no legal retention requirement. Both `ErasureMode.HardDelete`
and `ErasureMode.Anonymize` result in permanent deletion of metadata rows and
physical blob bytes.

**Deletion sequence:**

1. All `storage.storage_files` rows for the user are loaded via EF
   change-tracking.
2. Rows are removed from the DbContext and `SaveChangesAsync` is called.
   - For the DB-Blob provider, `storage.file_blobs` rows are cascade-deleted.
3. For every file, `IFileStorage.DeleteAsync(storageKey)` is called so that
   the physical bytes are removed by whichever backend is active (FileSystem,
   S3, Azure Blob, etc.).
   - Blob deletion is **best-effort**: a failure on any individual file is
     caught, logged at `Warning`, and does not abort the loop. This avoids
     partial erasures caused by transient provider errors.

The operation is idempotent — a second call for the same user finds no rows and
returns `Affected = 0`.

**`UserErasureResult` fields after a successful run:**

| Field | Value |
|---|---|
| `ModuleName` | `BieberWorks.SDK.Storage` |
| `Affected` | Number of metadata rows deleted |
| `Retained` | `0` (nothing kept) |
| `RetainedReason` | `null` |

::: warning Best-effort blob deletion
If `IFileStorage.DeleteAsync` fails for one or more files (e.g. S3 connectivity
issue), the metadata row is already gone but the physical bytes may remain.
The `Warning`-level log entry (`LogBlobDeleteFailed`) includes the `storageKey`
and `fileId` for manual cleanup.
:::

---

## Impact assessment (`StorageErasureImpactProvider`)

Returns `null` when `userId` is not a valid GUID or the user owns no files.
Otherwise returns a `UserErasureImpact` with a single item:

| Severity | Message |
|---|---|
| `Warning` | `"N file(s) (X.X MB) will be permanently deleted."` |

The count and total size (in MB, one decimal place) are derived from a single
aggregated database query (`COUNT` + `SUM(sizeBytes)`). No `Blocker` items are
ever raised; erasure can always proceed.

---

## Logging

| Logger class | Level | When |
|---|---|---|
| `StorageUserDataEraser` | `Information` | After each successful erasure; reports row count |
| `StorageUserDataEraser` | `Warning` | When `IFileStorage.DeleteAsync` fails for a file; includes `storageKey` and `fileId` |
| `StorageErasureImpactProvider` | `Debug` | When files are present; reports count and total MB |
