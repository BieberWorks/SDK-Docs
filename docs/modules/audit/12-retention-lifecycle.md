# Retention & Archival Lifecycle

SDK-Audit can automatically archive and drop old audit-log partitions from the live database
once they age past a configurable retention period, while still keeping the data durably
available in cold storage. This feature is **opt-in** and disabled by default — existing hosts
see no behaviour change until it is explicitly configured.

## Requirements

- **PostgreSQL 10 or newer** — the minimum for native `PARTITION BY RANGE` declarative
  partitioning. A currently-supported major release is recommended. The lifecycle job detaches
  aged partitions with a plain (blocking) `DETACH PARTITION`, which takes a brief exclusive lock
  on the parent table for the duration of the detach. `DETACH PARTITION CONCURRENTLY` is **not**
  used, because PostgreSQL rejects it while a `DEFAULT` partition exists — and the schema always
  provisions one as a safety net. The detach runs on the daily off-peak retention tick, so the
  short lock is acceptable.
- A registered `IFileStorage` implementation as the cold-storage sink (see
  [Storage dependency](#storage-dependency)) — required only when retention is enabled.

## How it works

`audit.entries` is a native PostgreSQL `PARTITION BY RANGE (timestamp)` table, partitioned
monthly (`entries_2026_07`, `entries_2026_08`, ...), plus a `DEFAULT` partition as a safety net
for any row outside the provisioned ranges. A daily background job
(`AuditRetentionHostedService` → `AuditRetentionRunner`) walks through the lifecycle for each
partition once it passes its retention window:

1. **Provision** the current + next month's partitions (idempotent — safe to run repeatedly).
2. **Identify archive candidates**: partitions whose range fully ended more than
   `DefaultRetention + ArchiveGracePeriod` ago.
3. **Category split**: rows belonging to a `CategoryOverrides` entry that isn't past its own
   retention window (or is marked `ArchiveOnly`) are copied into `audit.entries_retained`
   *before* anything is dropped — nothing is lost.
4. **Export** the full partition as gzip-compressed JSON Lines (streamed, no full
   materialisation) to `IFileStorage`, alongside a manifest (`{ partition, rowCount, sha256, exportedAt }`).
5. **Verify** the exported row count against a fresh count of the live partition.
6. **Detach + drop** the partition — skipped entirely for partitions where every category
   turned out to be `ArchiveOnly` (archived forever, never dropped).

Progress is tracked per-partition in `audit.retention_runs` (`Pending` → `Archived` →
`Verified` → `Dropped`, or `Failed`), so a restart or transient failure simply resumes from the
last completed step — every step is idempotent.

## Configuration

```json
{
  "Audit": {
    "Retention": {
      "Enabled": false,
      "DefaultRetention": "3650.00:00:00",
      "ArchiveGracePeriod": "30.00:00:00",
      "DryRun": false,
      "CategoryOverrides": {
        "User": { "RetainFor": "3650.00:00:00" }
      }
    }
  }
}
```

| Option | Default | Meaning |
|---|---|---|
| `Enabled` | `false` | Master switch. The hosted service is always registered but early-returns when disabled. |
| `DefaultRetention` | 3650 days (~10 years) | Retention window for any category without an override. |
| `ArchiveGracePeriod` | 30 days | Extra operational buffer added on top of the retention window before a partition is actually touched. |
| `DryRun` | `false` | Logs archive candidates without performing any writes/exports/drops. |
| `CategoryOverrides` | `{}` | Per-`Resource` (or `Resource:Action`) retention rules — see below. |

::: warning Composite `Resource:Action` keys cannot be set via appsettings.json
`Microsoft.Extensions.Configuration` flattens the entire configuration tree into `:`-joined
paths internally, so a literal colon in a JSON property name is indistinguishable from a
nesting separator once bound — a JSON key `"User:login"` binds as nested keys `User` →
`login`, not a single dictionary entry `"User:login"`. To use a composite category key, set it
programmatically after binding, e.g. `services.PostConfigure<AuditRetentionOptions>(o => ...)`.
A bare `Resource` key (e.g. `"User"`) works fine via `appsettings.json`.
:::

Each `CategoryOverrides` entry is an `AuditCategoryRetention`:

```csharp
public sealed class AuditCategoryRetention
{
    public TimeSpan? RetainFor    { get; set; } // null = retain forever
    public bool      ArchiveOnly  { get; set; } // archive on schedule, but never drop
}
```

## Storage dependency

Archival needs a cold-storage sink. Reference `BieberWorks.SDK.Storage` (or another
`IFileStorage` implementation) and register it before enabling retention. If
`Audit:Retention:Enabled` is `true` but no `IFileStorage` is registered, **module startup fails
fast** with a clear error rather than silently running a no-op background service.

## Triggering a run on demand

`IAuditAdmin` exposes two additive members (default-implemented, so pre-1.1.0 implementers of
`IAuditAdmin` keep compiling unchanged):

```csharp
Task<AuditRetentionStatus> GetRetentionStatusAsync(CancellationToken ct = default);
Task RunRetentionNowAsync(CancellationToken ct = default);
```

`AuditRetentionStatus` reports whether retention is enabled, the known partitions with their
lifecycle status, and the count of pending DSGVO remediation-queue entries (see below).

## GDPR interaction: the erasure-remediation queue

`AuditUserDataEraser` (used by `IUserDataEraser`) only reaches rows in the **live**, queryable
partitions. Once a partition has been archived and dropped, an erasure request for a user whose
data falls inside that partition's range cannot reach the cold copy anymore. Rather than
silently missing that data, the eraser detects this case and raises an entry in
`audit.erasure_remediation_queue` for manual operator follow-up (fully automated remediation of
already-exported archives is a fast-follow, out of scope for v1).

`IAuditAdmin` exposes two more additive members (default-implemented) to manage this queue:

```csharp
Task<IReadOnlyList<ErasureRemediationDto>> GetRemediationQueueAsync(
    bool includeResolved = false, CancellationToken ct = default);
Task<bool> ResolveRemediationAsync(Guid id, string? note = null, CancellationToken ct = default);
```

`ErasureRemediationDto` reports the affected user, the (already archived/dropped) partition,
the archive blob's storage key (if known), and the resolution state:

```csharp
public sealed record ErasureRemediationDto(
    Guid Id, string UserId, string Partition, string? ArchiveKey,
    DateTimeOffset RaisedAt, bool Resolved, DateTimeOffset? ResolvedAt, string? ResolutionNote);
```

`ResolveRemediationAsync` is idempotent: resolving an already-resolved entry returns `true`
again without overwriting the original `ResolvedAt`/note.

## Admin UI

The Admin nav section ("Audit") exposes four separate, individually-permissioned routes rather
than one combined page — hot (live, DB-queryable) and cold (archived-to-blob) data have
different UI shapes and different operator permissions:

| Route | Permission | Purpose |
|---|---|---|
| `/admin/audit` | `audit:logs:read` | Live audit-log entry grid (unchanged — see [IAuditService](./11-audit-service.md)) |
| `/admin/audit/archive` | `audit:retention:read` | Cold-archive partition index + JSONL.gz download |
| `/admin/audit/retention` | `audit:retention:read` (view) / `audit:retention:manage` (run) | Retention status, live partitions, manual "Run now" trigger |
| `/admin/audit/remediation` | `audit:retention:manage` | DSGVO erasure-remediation queue, mark-resolved action |

::: info Why the archive page is a partition index, not an entry grid
Cold data lives as compressed JSON Lines (`.jsonl.gz`) blobs in `IFileStorage`, not in the
queryable database — there is no per-row grid to page through. The archive page therefore only
lists partitions with their lifecycle status and an `ArchiveKey`, with a download link per
partition (streamed server-side through the `GET /api/audit/archive/{*archiveKey}` endpoint,
which is the only layer that talks to `IFileStorage` directly).
:::

## Manual runbook for large existing `entries` tables

The one-time migration (`PartitionEntriesByMonth`) copies every existing row from
`entries_legacy` into the new partitioned `entries` table inside a single migration
transaction, with a row-count guard that aborts (rolls back) on any mismatch. For very large
tables this copy can take a long time and holds locks for its duration. **This was not
automated** — for large production tables, plan a maintenance window or pre-warm/chunk the copy
manually before applying this migration.
