# SDK-Admin

The admin shell module for the BieberWorks SDK. Provides central navigation and extensible admin UI for all domain modules.

## Packages

- **`BieberWorks.SDK.Admin.Contracts`** — `IAdminSection`, `IAdminPage`, `AdminNavItem`, `IAdminNavigationService`, `INavOverrideTarget`. Dependency-free; implemented by other modules.
- **`BieberWorks.SDK.Admin.UI.MudBlazor`** — AdminLayout, AdminShell, navigation engine, override editor. Base UI for the admin shell.

## Version

See the [GitHub Releases page](https://github.com/BieberWorks/SDK-Admin/releases) for the latest stable version and changelog.

## Features

### IAdminSection — Extension Point

Each domain module implements `IAdminSection` and registers it via DI to offer one or more pages in the admin navigation. Properties:

- **`Key`** — Stable lower-kebab-case identifier (e.g. `"auth"`, `"storage"`). Used as the persistence key in the override store. Must be unique across all registered modules.
- **`Title`** — Display name in the drawer (e.g., `"Audit Logs"`)
- **`Icon`** — MudBlazor icon (e.g., `Icons.Material.Filled.History`)
- **`Order`** — Default sort position (ascending, lower = first)
- **`NavItems`** — List of navigation links
- **`IsEnabled(IServiceProvider)`** — Runtime condition (feature flags, permissions); returns `true` by default

### Navigation Override System

The admin nav supports persistent overrides (order, title, icon, visibility, item reassignment) stored via SDK-Settings. See [navigation.md](./navigation.md) for the full override model.

### Navigation Editor — `/admin/navigation`

A built-in editor page that lets admins manage navigation overrides through the UI. Requires `admin:shell:access` permission.

### Persistence via SDK-Settings

Overrides are stored in SDK-Settings. The admin shell functions without SDK-Settings (code-default order is used, no overrides applied).

### Permission Protection

The admin shell is protected by `admin:shell:access` permission. Only authorized users see the admin area.

## Setup

See [setup.md](./setup.md)

## Custom Pages

See [custom-pages.md](./custom-pages.md)

## Navigation Features

See [navigation.md](./navigation.md)

---

## Documentation

| Topic | File |
|---|---|
| Installation and registration | [setup.md](./setup.md) |
| Adding custom admin pages | [custom-pages.md](./custom-pages.md) |
| Navigation override system and editor | [navigation.md](./navigation.md) |
| Changelog | [CHANGES.md](./CHANGES.md) |
