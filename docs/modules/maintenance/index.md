# Maintenance

The Maintenance module puts a BieberWorks SDK host into maintenance mode at the middleware level. It intercepts all incoming HTTP requests, bypasses admins and whitelisted paths automatically, and either redirects browsers to a consumer-supplied maintenance page or returns a structured `503 JSON` payload for API clients — with zero DbContext overhead (state is stored in `ISettingsService`).

## What the module offers

- **Maintenance-mode middleware** — intercepts every HTTP request before routing; sub-microsecond hot path for bypassed requests (claim inspection only)
- **Four-stage decision tree** — bypass predicate → always-allowed paths → enable status check → response handling (redirect or 503 JSON)
- **Admin bypass by default** — authenticated users with the `Admin` role always pass through; fully overridable via `BypassPredicate`
- **Path whitelisting** — `AlwaysAllowedPaths` for host-level config; `IMaintenancePathProvider` for reusable packages that contribute paths without touching host configuration
- **Settings-backed storage** — no migration, no DbContext; state is stored under `Maintenance:*` keys in `ISettingsService` with automatic in-process caching
- **Automatic auditing** — every toggle/edit raises `SettingChangedEvent : IAuditableEvent`, captured by SDK-Audit with no direct Audit dependency
- **Admin UI** — `/admin/maintenance` page (MudBlazor) with toggle switch, content editor (title, message, reason, ETA), live preview, and timestamped enable indicator
- **Localization support** — UI strings in `MaintenanceUiResources.resx`; DB-level overrides via SDK-Localization
- **API-aware responses** — `Accept: application/json` or `/api/` prefix returns a structured 503 payload; browser requests get a 302 redirect

## Package overview

| Package | Description | When needed |
|---|---|---|
| `BieberWorks.SDK.Maintenance.Contracts` | `IMaintenanceModeService`, `IMaintenancePathProvider`, `MaintenanceStatus` record — no implementation dependency | When another module or consumer page reads maintenance state |
| `BieberWorks.SDK.Maintenance` | Middleware, `MaintenanceModeService`, `MaintenanceOptions`, `IModule` registration | In every host that must serve maintenance mode |
| `BieberWorks.SDK.Maintenance.UI.MudBlazor` | Admin UI page at `/admin/maintenance`, `IAdminSection` registration | When the SDK-Admin shell is present in the host |

::: tip Versioning
All packages share one version, computed from Conventional Commits. The latest release and full history live on the [GitHub Releases page](https://github.com/BieberWorks/SDK-Maintenance/releases) (see [changelog](CHANGES.md)).
:::

## When to use which package

| Scenario | Required packages |
|---|---|
| Consumer page or component reads current maintenance state | `Maintenance.Contracts` |
| Reusable module contributes whitelisted paths | `Maintenance.Contracts` (implements `IMaintenancePathProvider`) |
| Host needs the maintenance middleware | `Maintenance` |
| Host includes the SDK-Admin shell | `Maintenance` + `Maintenance.UI.MudBlazor` |

## Documentation

| Topic | Document |
|---|---|
| Settings-backed storage rationale, middleware decision tree, setting keys, package dependency diagram, `IMaintenancePathProvider` extension point, performance characteristics | [Architecture](architecture.md) |
| NuGet references, `Program.cs` registration, `Routes.razor`, `MaintenanceOptions` reference, allowed paths, consumer maintenance page, Admin UI, localization, API response format | [Usage Guide](usage.md) |
| Release history | [Changelog](CHANGES.md) |
