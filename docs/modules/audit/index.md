# SDK-Audit

The **SDK-Audit** module provides automatic, configuration-free audit logging for all BieberWorks modules. Every domain event implementing `IAuditableEvent` is persisted in the audit database without additional code in the triggering module.

## What the module offers

- **Auto-Auditing** via `IAuditableEvent`: A generic open-generic handler (`AuditableEventHandler<TEvent>`) automatically intercepts all auditable domain events and writes them to the audit log. No audit code in the respective domain module necessary.
- **`IAuditService`** with methods for reading, filtering, and deleting audit entries.
- **REST endpoints** under `/api/audit` (GET, GET `/facets`, DELETE).
- **Admin UI** (MudBlazor) under `/admin/audit` with pagination, full-text search, and multi-select filters.
- **GDPR / privacy support**: implements `IUserDataExporter` (exports all audit entries for a user as JSON) and `IUserDataEraser` (anonymises the `UserId` column with a tombstone — rows are retained as forensic evidence regardless of erasure mode).
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
| `BieberWorks.SDK.Audit.Contracts` | `IAuditService`, `AuditEntry`, `AuditEntryDto`, `AuditFilter`, `AuditFacets`, `PagedResult<T>`, `AuditPermissions` |
| `BieberWorks.SDK.Audit` | Implementation: `AuditModule`, `AuditService`, `AuditableEventHandler<T>`, `AuditDbContext`, migrations, endpoints, GDPR providers |
| `BieberWorks.SDK.Audit.UI` | Framework-agnostic base class `AuditLogPageBase` |
| `BieberWorks.SDK.Audit.UI.MudBlazor` | MudBlazor admin pages + `AddAuditUi()` |

## Dependencies

```
BieberWorks.SDK.Audit
  └─ BieberWorks.SDK.Audit.Contracts
       └─ BieberWorks.SDK.SharedKernel   (IAuditableEvent, IDomainEvent)
       └─ BieberWorks.SDK.Core           (IDomainEventProcessor<T>)
       └─ BieberWorks.SDK.Auth.Contracts (IPermissionContributor — only for AuditPermissions)
```

::: warning AuditPermissions and Auth.Contracts
`AuditPermissions` in `Audit.Contracts` implements `IPermissionContributor` from `Auth.Contracts`. This makes `Auth.Contracts` a transitive dependency of `Audit.Contracts`. The actual audit core logic (`AuditableEventHandler`, `AuditService`) is unaffected.
:::

## Documentation

| Topic | Description |
|---|---|
| [Setup & Configuration](./setup.md) | NuGet packages, `Program.cs` wiring, connection string, Blazor router |
| [Auto-Auditing](./auto-auditing.md) | How `IAuditableEvent` works, open-generic handler, making events auditable |
| [IAuditService](./audit-service.md) | Service interface, filter model, REST endpoints, permissions, GDPR |
| [Changelog](./CHANGES.md) | Pointer to GitHub Releases |
