# SDK-Admin

The admin shell module for the BieberWorks SDK. Provides central navigation and extensible admin UI for all domain modules.

## Packages

- **`BieberWorks.SDK.Admin.Contracts`** — `IAdminSection`, `IAdminPage`, `AdminNavItem`. Dependency-free, implemented by other modules.
- **`BieberWorks.SDK.Admin.UI.MudBlazor`** — AdminLayout, AdminShell, Navigation engine. Base UI for the admin shell.

## Version History

**v0.3.0** — current version

## Features

### IAdminSection — Extension Point

Each domain module implements `IAdminSection` and registers it via DI to offer one or more pages in the admin navigation. Properties:

- **`Title`** — Display name in drawer (e.g., "Audit Logs")
- **`Icon`** — MudBlazor icon (e.g., `Icons.Material.Filled.History`)
- **`Order`** — Sort position (ascending by seconds)
- **`NavItems`** — List of navigation links
- **`IsEnabled(IServiceProvider)`** — Runtime condition (feature flags, permissions)

### Navigation with Drag-and-Drop

In **Edit Mode** (only for users with `admin:shell:access` permission):

- Reorder sections via drag-and-drop
- Create, rename, and delete custom folders
- Move sections into folders
- All groups collapsed by default

### Persistence via SDK-Settings

Navigation is stored in SDK-Settings under key `admin.nav.section-order`. Format: JSON v2 with sections and folders. The admin shell functions without SDK-Settings (order is not persisted).

### Permission Protection

The admin shell is protected by `admin:shell:access` permission. Only authorized users see the admin area.

## Setup

See [setup.md](./setup.md)

## Custom Pages

See [custom-pages.md](./custom-pages.md)

## Navigation Features

See [navigation.md](./navigation.md)
