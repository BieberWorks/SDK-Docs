# Permissions — SDK-Pages

SDK-Pages registers five permissions via `PagesPermissionContributor` (implements `IPermissionContributor`). They are automatically discovered and seeded into SDK-Auth's permission store on module startup — no manual setup required in the host.

## Permission Keys

All constants are defined in `BieberWorks.SDK.Pages.Contracts.PagesPermissions`.

| Constant | Key | Display Name | Description |
|---|---|---|---|
| `PagesPermissions.PagesRead` | `pages:pages:read` | Seiten lesen | View the page list and page details in the admin UI |
| `PagesPermissions.PagesCreate` | `pages:pages:create` | Seiten erstellen | Create new pages |
| `PagesPermissions.PagesEdit` | `pages:pages:edit` | Seiten bearbeiten | Edit page content, slug, and meta fields |
| `PagesPermissions.PagesDelete` | `pages:pages:delete` | Seiten löschen | Delete pages |
| `PagesPermissions.PagesPublish` | `pages:pages:publish` | Seiten veröffentlichen | Publish and unpublish pages |

All permissions belong to module `"Pages"`, group `"Seiten"`.

## Permission Mapping

| `IPageAdminService` method | Required permission |
|---|---|
| `GetAllAsync` / `GetPagedAsync` / `GetByIdAsync` | `PagesRead` |
| `SlugExistsAsync` | `PagesRead` |
| `CreateAsync` | `PagesCreate` |
| `UpdateAsync` | `PagesEdit` |
| `PublishAsync` / `UnpublishAsync` | `PagesPublish` |
| `DeleteAsync` | `PagesDelete` |

## Enforcement Layers

**Service layer (primary):** `PageAdminService` calls `IPermissionService` before every DB operation. If the permission check fails, the method returns `Result.Failure("Permission denied")` without touching the database.

**UI layer (secondary):** Action buttons (Edit, Publish/Unpublish, Delete) are hidden when the current user lacks the corresponding permission. This is a UX optimization only — the service layer is the authoritative security gate.

**Public route:** `/p/{slug}` is explicitly permission-free. Draft pages return `null` → 404 response, not 401. Role-based visibility is separate from the permission system — see [role-access.md](role-access.md).

## Authorization Policies

The admin Razor pages use ASP.NET Core authorization policies derived from permission keys:

```razor
@attribute [Authorize(Policy = "perm:pages:pages:read")]   // PagesListPage
@attribute [Authorize(Policy = "perm:pages:pages:create")]  // PageCreatePage
@attribute [Authorize(Policy = "perm:pages:pages:edit")]    // PageEditPage
```

Policy names follow the convention `perm:{permission-key}` as registered by SDK-Auth.
