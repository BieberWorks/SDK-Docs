# Admin

The admin shell module for the BieberWorks SDK. Provides central navigation and extensible admin UI for all domain modules.

## Packages

| Package | Contents |
|---|---|
| `BieberWorks.SDK.Admin.Contracts` | `IAdminPage`, `IAdminSection` (empty marker over `IShellSection`), `AdminPermissions`. Dependency-free (besides `BieberWorks.SDK.Shell.Contracts`); implemented by other modules. |
| `BieberWorks.SDK.Admin` | `AdminModule` (`IModule` + `IEndpointModule` + `IModuleInitializer`), `AdminDbContext` (schema `"admin"`), `AdminPermissionContributor`, `AddBieberWorksAdmin()` (registers the Admin shell via `AddBwShell<IAdminSection>()`). Requires `DefaultConnection`. |
| `BieberWorks.SDK.Admin.UI.Blazor.MudBlazor` | `AdminLayout`, `AdminShell`, `AdminUiMudBlazorModule`. UI skin only. `AddBieberWorksAdminUi()` registers MudBlazor services. |

The host must reference **both** `BieberWorks.SDK.Admin` and `BieberWorks.SDK.Admin.UI.Blazor.MudBlazor`. `AddBieberWorksModules(config)` discovers `AdminModule` from the impl package and `AdminUiMudBlazorModule` from the skin automatically.

::: info Depends on SDK-Shell
Admin's navigation kernel — `IShellSection`, `ShellNavItem`, `IShellNavigationService<TMarker>`, the override model, and the navigation editor component — lives in the standalone **SDK-Shell** module (`BieberWorks.SDK.Shell.Contracts` / `.Shell` / `.Shell.UI.Blazor.MudBlazor(.MudBlazor)`). Admin only supplies the `IAdminSection` marker and the concrete `ShellDefinition("admin", "/admin", "Admin")`. See the SDK-Shell docs for the full navigation/override reference.
:::

## Version

See the [GitHub Releases page](https://github.com/BieberWorks/SDK-Admin/releases) for the latest stable version and changelog.

## Features

### IAdminSection — Extension Point

The generic navigation kernel (`IShellSection`, `ShellNavItem`, resolve pipeline) lives in `BieberWorks.SDK.Shell.Contracts`. `Admin.Contracts` defines `IAdminSection` as an empty marker interface deriving from `IShellSection` — it exists purely to scope section registrations to the Admin shell (as opposed to the Account shell or a future shell). Each domain module implements `IAdminSection` and registers it via DI (`services.AddSingleton<IAdminSection, MyAdminSection>()`) to offer one or more pages in the admin navigation. The Admin shell discovers all registered `IAdminSection` instances through `IShellNavigationService<IAdminSection>`. Properties (all inherited from `IShellSection`):

- **`Key`** — Stable lower-kebab-case identifier (e.g. `"auth"`, `"storage"`). Used as the persistence key in the override store. Must be unique across all registered modules.
- **`Title`** — Display name in the drawer (e.g., `"Audit Logs"`)
- **`Icon`** — MudBlazor icon (e.g., `Icons.Material.Filled.History`)
- **`Order`** — Default sort position (ascending, lower = first)
- **`NavItems`** — List of `ShellNavItem` navigation links
- **`IsEnabled(IServiceProvider)`** — Runtime condition (feature flags, permissions); returns `true` by default

### Navigation Override System

The admin nav supports persistent overrides (order, title, icon, visibility, item reassignment) stored via SDK-Settings. The override model and resolve pipeline are implemented once in SDK-Shell and shared by every shell. See [11-navigation.md](./11-navigation.md) for the Admin-specific summary and the SDK-Shell docs for the full reference.

### Navigation Editor — `/admin/navigation`

A page hosting the generic `BwShellNavEditor` component (from `BieberWorks.SDK.Shell.UI.Blazor.MudBlazor`) that lets admins manage navigation overrides for **all** registered shells (Admin, Account, future shells) through one tabbed UI. Requires `admin:shell:access` permission.

### Persistence via SDK-Settings

Overrides are stored in SDK-Settings. The admin shell functions without SDK-Settings (code-default order is used, no overrides applied).

### Permission Protection

The admin shell is protected by `admin:shell:access` permission. Only authorized users see the admin area.

## Setup

See [01-getting-started.md](./01-getting-started.md)

## Custom Pages

See [10-custom-pages.md](./10-custom-pages.md)

## Navigation Features

See [11-navigation.md](./11-navigation.md)

---

## Documentation

| Topic | File |
|---|---|
| Installation and registration | [01-getting-started.md](./01-getting-started.md) |
| Adding custom admin pages | [10-custom-pages.md](./10-custom-pages.md) |
| Navigation override system and editor | [11-navigation.md](./11-navigation.md) |
| Changelog | [90-changelog.md](./90-changelog.md) |
