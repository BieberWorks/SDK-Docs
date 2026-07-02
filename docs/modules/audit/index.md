# Audit

The **SDK-Audit** module provides automatic, configuration-free audit logging for all BieberWorks modules. Every domain event implementing `IAuditableEvent` is persisted in the audit database without additional code in the triggering module.

## What the module offers

- **Auto-Auditing** via `IAuditableEvent`: A generic open-generic handler (`AuditableEventHandler<TEvent>`) automatically intercepts all auditable domain events and writes them to the audit log. No audit code in the respective domain module necessary.
- **`IAuditService`** with methods for reading, filtering, and deleting audit entries.
- **REST endpoints** under `/api/audit` (GET, GET `/facets`, DELETE).
- **Admin UI** (MudBlazor) under `/admin/audit` with pagination, full-text search, and multi-select filters, plus three separately-permissioned retention-lifecycle admin pages (`/admin/audit/archive`, `/admin/audit/retention`, `/admin/audit/remediation` — see [Retention & Archival Lifecycle](./12-retention-lifecycle.md)).
- **GDPR / privacy support**: implements `IUserDataExporter` (exports all audit entries for a user as JSON) and `IUserDataEraser` (anonymises `UserId`, `ResourceId`, and `Details` with a tombstone/null — rows are retained as forensic evidence regardless of erasure mode).
- **Retention & archival lifecycle** (opt-in): native PostgreSQL monthly partitioning, automatic archive-to-cold-storage + drop of old partitions past a configurable retention window, with a DSGVO erasure-remediation queue for edge cases. See [Retention & Archival Lifecycle](./12-retention-lifecycle.md).
- Separate **PostgreSQL schema** `audit` — complete isolation, no DB-JOIN with other modules.

::: info No core dependency on Auth
SDK-Audit's core logic only depends on **SDK-Foundation** (`BieberWorks.SDK.SharedKernel` + `BieberWorks.SDK.Core`). The open-generic handler `AuditableEventHandler<TEvent>` is resolved via MS.DI reflection to concrete event types — at runtime, not compile time. Auth or Auth.Contracts are not referenced by the handler.
:::

::: tip Current version
All SDK-Audit packages are released together. See the [GitHub Releases page](https://github.com/BieberWorks/SDK-Audit/releases) for the latest stable version.
:::

## Packages

| Package | Description |
|---|---|
| `BieberWorks.SDK.Audit.Contracts` | `IAuditService` (+ segregated `IAuditWriter` / `IAuditReader` / `IAuditAdmin`), `AuditEntry`, `AuditEntryDto`, `AuditFilter`, `AuditFacets` |
| `BieberWorks.SDK.Audit` | Implementation: `AuditModule`, `AuditService`, `AuditableEventHandler<T>`, `AuditDbContext`, migrations, endpoints, GDPR providers |
| `BieberWorks.SDK.Audit.UI` | Framework-agnostic base class `AuditLogPageBase` |
| `BieberWorks.SDK.Audit.UI.MudBlazor` | MudBlazor admin pages + `AddAuditUi()` |

## Dependencies

```
BieberWorks.SDK.Audit                    (impl — references Auth.Contracts for AuditPermissions)
  └─ BieberWorks.SDK.Audit.Contracts
       └─ BieberWorks.SDK.SharedKernel    (IAuditableEvent, IDomainEvent, PagedResult<T>)
       └─ BieberWorks.SDK.Core            (IDomainEventProcessor<T>)
  └─ BieberWorks.SDK.Storage.Contracts    (IFileStorage — cold-archive sink for retention lifecycle)
```

::: info Storage.Contracts is only required when retention is enabled
The retention/archival lifecycle needs `IFileStorage` to export partitions to cold storage.
`BieberWorks.SDK.Audit` references `BieberWorks.SDK.Storage.Contracts` (interfaces only, no
concrete backend) at compile time; a concrete `IFileStorage` implementation (e.g.
`BieberWorks.SDK.Storage`) only needs to be registered at runtime if
`Audit:Retention:Enabled` is `true` — see [Retention & Archival Lifecycle](./12-retention-lifecycle.md).
:::

::: info Contracts has no Auth dependency
`Audit.Contracts` depends only on SDK-Foundation. `AuditPermissions` (the `IPermissionContributor` that pulls in `Auth.Contracts`) lives in the `BieberWorks.SDK.Audit` **implementation** assembly, so modules that reference `Audit.Contracts` to consume `IAuditService` do not transitively pull in `Auth.Contracts`.
:::

## Documentation

| Topic | Description |
|---|---|
| [Setup & Configuration](./01-getting-started.md) | NuGet packages, `Program.cs` wiring, connection string, Blazor router |
| [Auto-Auditing](./10-auto-auditing.md) | How `IAuditableEvent` works, open-generic handler, making events auditable |
| [IAuditService](./11-audit-service.md) | Service interface, filter model, REST endpoints, permissions, GDPR |
| [Retention & Archival Lifecycle](./12-retention-lifecycle.md) | Partitioning, archive-to-cold-storage, retention config, erasure-remediation queue |
| [Changelog](./90-changelog.md) | Pointer to GitHub Releases |
