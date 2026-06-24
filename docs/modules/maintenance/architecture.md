# SDK-Maintenance — Architecture

## Decision: Settings vs. DbContext

**Decision: Settings-backed storage via `ISettingsService`.**

The maintenance state is a small, infrequently written, frequently read value set:

- **No domain query surface.** The module reads one current state. `ISettingsService` is purpose-built for exactly this shape.
- **Zero migration overhead.** A DbContext requires an EF migration, schema, and registered `IModule` that calls `ApplyMigrationsAsync`. Not justified for this narrow feature.
- **Automatic caching.** `CachedSettingsStore` provides a sliding/absolute cache (5 min / 30 min). The middleware hot path — checked on every incoming HTTP request — needs sub-millisecond reads. Settings provides this for free.
- **Automatic auditing.** Settings raises `SettingChangedEvent : IAuditableEvent` on every write. Maintenance-mode toggles and content edits are automatically logged to SDK-Audit with zero Audit dependency in this module.
- **Reduced consumer setup.** SDK-Admin already mandates Settings at host level. No additional dependency burden.

**Trade-off:** Hard dependency on `BieberWorks.SDK.Settings.Contracts`. Acceptable because any host running SDK-Admin already has Settings.

**Future escape hatch:** If maintenance-window history is needed (all past windows with start/end timestamps), a `MaintenanceDbContext` can be added as a non-breaking addition at that point.

---

## Middleware Decision Tree

```
Incoming HTTP request
        |
        v
[1] BypassPredicate(ctx) == true?
        YES → next()    [explicit consumer bypass — runs before IsEnabledAsync to save a Settings round-trip]
        NO  ↓
[2] path starts with AlwaysAllowedPaths?
        YES → next()    [/admin, /health, /_blazor, /_framework, /maintenance, /favicon.ico]
        NO  ↓
[3] IsEnabledAsync() == false?
        YES → next()    [maintenance inactive — normal flow]
        NO  ↓
[4] Accept: application/json OR path starts with /api/?
        YES → HTTP 503  { status, title, message, reason, eta }  Content-Type: application/json
        NO  ↓
[5] HTTP 302 redirect to options.PagePath (/maintenance by default)
```

**Key design rationale:**
- Bypass check comes first — avoids a Settings cache read for every request from authenticated admins.
- `AlwaysAllowedPaths` is a simple prefix match (not regex) — zero-overhead hot-path evaluation.
- `/_blazor` and `/_framework` are in the default allowed list — omitting them breaks Blazor SignalR and static assets.

---

## Package Dependency Diagram

```
BieberWorks.SDK.Maintenance.Contracts
  ├── BieberWorks.SDK.SharedKernel
  └── BieberWorks.SDK.Settings.Contracts

BieberWorks.SDK.Maintenance
  ├── BieberWorks.SDK.Maintenance.Contracts
  ├── BieberWorks.SDK.Core               (IModule, IModuleInitializer)
  └── [Microsoft.AspNetCore.*]           (implicit via Sdk.Web)

BieberWorks.SDK.Maintenance.UI.MudBlazor
  ├── BieberWorks.SDK.Maintenance.Contracts
  ├── BieberWorks.SDK.Core               (IModule)
  ├── BieberWorks.SDK.Admin.Contracts    (IAdminSection, AdminNavItem)
  ├── BieberWorks.SDK.Settings.Contracts (ISettingsAdminService — write path)
  ├── BieberWorks.SDK.Theme.Contracts    (IBrandingService — logo in preview)
  └── MudBlazor 9.*
```

**UI dependency rule compliance:**
- No `*.UI.MudBlazor → *.UI.MudBlazor` reference — only `SDK.UI.MudBlazor` as shared layer (not referenced here; Admin shell provides layout).
- `Contracts` package is MudBlazor-free.
- `IAdminSection.Key = "maintenance"` is set (mandatory since Admin 1.0.0).
- Double-registration guard via `TryAddEnumerable` in `MaintenanceUiModule`.
