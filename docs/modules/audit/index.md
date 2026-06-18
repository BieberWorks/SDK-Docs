# SDK-Audit

Das **SDK-Audit**-Modul bietet automatisches, konfigurationsfreies Audit-Logging für alle BieberWorks-Module. Jedes Domain-Event, das `IAuditableEvent` implementiert, wird ohne zusätzlichen Code im auslösenden Modul in der Audit-Datenbank persistiert.

## Was das Modul bietet

- **Auto-Auditing** via `IAuditableEvent`: Ein generischer Open-Generic-Handler (`AuditableEventHandler<TEvent>`) fängt automatisch alle auditfähigen Domain-Events ab und schreibt sie in das Audit-Log. Kein Audit-Code im jeweiligen Fachmodul notwendig.
- **`IAuditService`** mit Methoden zum Lesen, Filtern und Löschen von Audit-Einträgen.
- **REST-Endpunkte** unter `/api/audit` (GET, GET `/facets`, DELETE).
- **Admin-UI** (MudBlazor) unter `/admin/audit` mit Paginierung, Freitextsuche und Multiselect-Filtern.
- Eigenes **PostgreSQL-Schema** `audit` — vollständige Isolation, kein DB-JOIN mit anderen Modulen.

::: info Keine Kernabhängigkeit zu Auth
SDK-Audit hängt in seiner Kern-Logik nur von **SDK-Foundation** ab (`BieberWorks.SDK.SharedKernel` + `BieberWorks.SDK.Core`). Der Open-Generic-Handler `AuditableEventHandler<TEvent>` wird per MS.DI-Reflection auf konkrete Event-Typen aufgelöst — zur Laufzeit, nicht zur Compile-Zeit. Auth oder Auth.Contracts werden vom Handler nicht referenziert.
:::

## Pakete

| Paket | Beschreibung |
|---|---|
| `BieberWorks.SDK.Audit.Contracts` | `IAuditService`, `AuditEntry`, `AuditEntryDto`, `AuditFilter`, `AuditFacets`, `PagedResult<T>`, `AuditPermissions` |
| `BieberWorks.SDK.Audit` | Implementierung: `AuditModule`, `AuditService`, `AuditableEventHandler<T>`, `AuditDbContext`, Migrations, Endpoints |
| `BieberWorks.SDK.Audit.UI` | Framework-agnostische Basisklasse `AuditLogPageBase` |
| `BieberWorks.SDK.Audit.UI.MudBlazor` | MudBlazor-Admin-Seiten + `AddAuditUi()` |

## Abhängigkeiten

```
BieberWorks.SDK.Audit
  └─ BieberWorks.SDK.Audit.Contracts
       └─ BieberWorks.SDK.SharedKernel   (IAuditableEvent, IDomainEvent)
       └─ BieberWorks.SDK.Core           (IDomainEventProcessor<T>)
       └─ BieberWorks.SDK.Auth.Contracts (IPermissionContributor — nur für AuditPermissions)
```

::: warning AuditPermissions und Auth.Contracts
`AuditPermissions` in `Audit.Contracts` implementiert `IPermissionContributor` aus `Auth.Contracts`. Das macht `Auth.Contracts` zu einer transitiven Abhängigkeit von `Audit.Contracts`. Die eigentliche Audit-Kern-Logik (`AuditableEventHandler`, `AuditService`) ist davon unberührt.
:::

## Weiterführende Seiten

- [Setup & Konfiguration](./setup.md)
- [Auto-Auditing](./auto-auditing.md)
- [IAuditService](./audit-service.md)
