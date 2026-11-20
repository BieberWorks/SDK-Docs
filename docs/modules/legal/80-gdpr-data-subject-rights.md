# GDPR Data-Subject Rights (Phase 3)

This document covers the Phase 3 additions to SDK-Legal: the data-export and data-erasure
orchestration, the best-effort erasure saga, Legal's own exporter/eraser implementations,
the account-deletion event handler, and the admin UI at `/admin/legal/gdpr`.

---

## Architecture Overview

Phase 3 is built around two SharedKernel extension points:

| Interface | Namespace | Purpose |
|---|---|---|
| `IUserDataExporter` | `BieberWorks.SDK.SharedKernel` | Modules implement this to export a user's data |
| `IUserDataEraser` | `BieberWorks.SDK.SharedKernel` | Modules implement this to erase/anonymise a user's data |
| `IUserDataErasureImpactProvider` | `BieberWorks.SDK.SharedKernel` | Modules report the expected impact before erasure is confirmed |

SDK-Legal's **orchestrator** collects all registered implementations via DI and drives them.
No module needs to depend on SDK-Legal — it depends on SharedKernel only.

---

## `IUserDataPrivacyOrchestrator`

**Package:** `BieberWorks.SDK.Legal.Contracts`  
**Namespace:** `BieberWorks.SDK.Legal.Contracts`

```csharp
public interface IUserDataPrivacyOrchestrator
{
    Task<IReadOnlyList<UserDataExport>> ExportAllAsync(
        string userId, CancellationToken ct = default);

    Task<Guid> RequestErasureAsync(
        string userId, ErasureMode mode, CancellationToken ct = default);

    Task<UserErasureRequestDto?> GetErasureRequestAsync(
        Guid requestId, CancellationToken ct = default);
}
```

### `ExportAllAsync`

Calls every registered `IUserDataExporter` in parallel (`Task.WhenAll`) and returns one
`UserDataExport` per module. Each export contains the module name and a JSON payload whose
structure is defined by the module. The call does **not** persist anything and raises
`UserDataExportRequestedEvent` only when triggered via the admin UI (not when called
programmatically by other code).

### `RequestErasureAsync`

1. Creates and persists a `UserErasureRequest` (schema `legal`) inside a transaction.
2. Publishes `UserDataErasureRequestedEvent` after the commit (audit trail, pre-saga).
3. Iterates every registered `IUserDataEraser` sequentially — best-effort, no two-phase
   commit. Each module result is persisted independently. A module failure does not abort
   remaining erasers.
4. Idempotency: if a successful result already exists for a `(RequestId, ModuleName)` pair,
   that eraser is skipped.
5. Determines final status (`Completed` / `PartiallyFailed`) and persists it.
6. Publishes `UserDataErasedEvent` after the final commit.

Returns the `Guid` request ID for status polling.

### `GetErasureRequestAsync`

Returns the persisted `UserErasureRequestDto` including per-module results, or `null` if no
request with the given ID exists.

---

## Erasure Saga

### Entities (`schema: legal`)

**`UserErasureRequest`**

| Column | Type | Notes |
|---|---|---|
| `Id` | `uuid` | Primary key |
| `UserId` | `text` | Identity user ID |
| `Mode` | `ErasureMode` | `HardDelete` or `Anonymize` |
| `Status` | `ErasureStatus` | See below |
| `CreatedAt` | `timestamptz` | Set at creation |
| `CompletedAt` | `timestamptz?` | Set when the saga finishes |

**`UserErasureModuleResult`**

| Column | Type | Notes |
|---|---|---|
| `Id` | `uuid` | Primary key |
| `ErasureRequestId` | `uuid` (FK) | Parent request |
| `ModuleName` | `text` | Module identifier string |
| `Affected` | `int` | Records deleted or anonymised |
| `Retained` | `int` | Records kept (retention obligation) |
| `RetainedReason` | `text?` | Human-readable; null when `Retained = 0` |
| `Error` | `text?` | Exception message; null on success |

A unique index on `(ErasureRequestId, ModuleName)` ensures idempotency on re-drive.

### `ErasureStatus`

| Value | Meaning |
|---|---|
| `Pending` | Request created; saga in progress |
| `Completed` | All modules succeeded |
| `PartiallyFailed` | At least one module returned an error; remaining modules still ran |

### `ErasureMode`

Defined in `BieberWorks.SDK.SharedKernel`.

| Value | Behaviour |
|---|---|
| `HardDelete` | Permanently removes records |
| `Anonymize` | Replaces personal identifiers with a tombstone value; record structure is retained |

### Consistency Guarantees

The saga is **eventual-consistent, not atomic**. Each module eraser runs in its own
transaction. If a module throws, its failure is recorded and the next module continues.
This is a deliberate trade-off: a single unresponsive downstream module must not block
the erasure of all other data.

Records that cannot be deleted for legal or technical reasons are counted in `Retained`
with a `RetainedReason`. Retained records are not an error.

Events are always published **after** the database commit, following the Core.Postgres rule
enforced throughout the SDK.

---

## Legal Module Implementations

### `LegalUserDataExporter`

Exports the full consent history of the user as a JSON array. Each element contains:
`Id`, `DocumentKey`, `ConsentKey`, `AcceptedVersion`, `Granted`, `AcceptedAt`, `RevokedAt`.

`ModuleName`: `"BieberWorks.SDK.Legal"`

### `LegalUserDataEraser`

Erases or anonymises all `UserConsent` records for the user.

- **`HardDelete`**: removes all consent rows permanently. `Retained = 0`.
- **`Anonymize`**: replaces `UserId` with the tombstone `"ERASED"` on every row.
  `Retained = N`, `RetainedReason = "consent proof retention"`. Consent records are kept
  because they may serve as proof of GDPR-compliant consent in audits.

`ModuleName`: `"BieberWorks.SDK.Legal"`

### `LegalErasureImpactProvider`

Reports the number of consent records that will be affected before an admin commits to
erasure. Returns a single `ErasureImpactItem` with severity `Warning` if `consentCount > 0`,
or `null` if the user has no consent records (no impact to report).

`ModuleName`: `"BieberWorks.SDK.Legal"`

---

## Account-Deletion Integration

```
SDK-Auth publishes UserAccountDeletionRequestedEvent (SharedKernel)
          |
          v
SDK-Legal: AccountDeletionErasureHandler (IDomainEventProcessor<UserAccountDeletionRequestedEvent>)
          |
          v
IUserDataPrivacyOrchestrator.RequestErasureAsync(targetUserId, event.Mode)
```

`AccountDeletionErasureHandler` is an `IDomainEventProcessor<UserAccountDeletionRequestedEvent>`.
It has **no compile-time dependency on SDK-Auth** — the event type lives in
`BieberWorks.SDK.SharedKernel`, so the coupling is purely runtime (DI event bus).

This handler is the primary trigger for automated erasure. Manual admin-initiated erasure
via the UI (see below) is independent and can also be used for standalone GDPR requests.

---

## Admin UI — `/admin/legal/gdpr`

**Route:** `/admin/legal/gdpr`  
**Permission:** `perm:legal:admin`  
**Package:** `BieberWorks.SDK.Legal.UI.Blazor.MudBlazor`

The page is registered as an `IAdminPage` and appears under the Legal admin section.

### Export Tab

1. Admin enters a user ID.
2. On submit, calls `IUserDataPrivacyOrchestrator.ExportAllAsync`.
3. Combines all per-module JSON payloads into a single keyed JSON object
   (`{ "ModuleName": { ... }, ... }`).
4. Triggers a browser download via `gdpr.js` (`downloadJson`).
5. Publishes `UserDataExportRequestedEvent` (audit trail).

Download file name: `gdpr-export-{userId}-{timestamp}.json`

### Erasure Tab

1. Admin enters a user ID and selects an `ErasureMode` (`Anonymize` is the default).
2. A confirmation dialog is shown before the erasure starts.
3. On confirm, calls `IUserDataPrivacyOrchestrator.RequestErasureAsync`.
4. The returned request ID is shown and pre-filled into the status lookup field.

### Status Lookup (within Erasure Tab)

Admin enters a request ID (GUID) and loads the `UserErasureRequestDto`. The page shows:
- Overall `Status` and `CompletedAt`
- A data grid of per-module results with columns: Module, Affected, Retained, RetainedReason, Error

---

## Domain Events & Audit Trail

All three GDPR events implement `IAuditableEvent` and are picked up automatically by SDK-Audit.

| Event | `AuditAction` | When raised |
|---|---|---|
| `UserDataExportRequestedEvent` | `legal:gdpr:export-requested` | After admin triggers data export |
| `UserDataErasureRequestedEvent` | `legal:gdpr:erasure-requested` | After erasure request is persisted (pre-saga) |
| `UserDataErasedEvent` | `legal:gdpr:erased` | After the saga completes (final status committed) |

`UserDataErasedEvent` carries `FinalStatus` so the audit log reflects whether the erasure
was fully completed or partially failed.

Events are published **after** database commits. The pre-saga `UserDataErasureRequestedEvent`
provides an early audit record in case the process is interrupted before completion.

---

## Implementing `IUserDataEraser` in Your Module

Any SDK module that stores personal data should register its own eraser and exporter so
the orchestrator can include it automatically.

```csharp
// In your module's IModule.RegisterServices / ServiceCollectionExtensions:
services.AddScoped<IUserDataEraser, MyModuleUserDataEraser>();
services.AddScoped<IUserDataExporter, MyModuleUserDataExporter>();
services.AddScoped<IUserDataErasureImpactProvider, MyModuleErasureImpactProvider>(); // optional
```

The `ModuleName` property must return a stable, unique string (typically the package name).

For retained records, set `RetainedReason` to a plain-English explanation of the legal or
technical obligation. The admin UI surfaces this in the status grid.
