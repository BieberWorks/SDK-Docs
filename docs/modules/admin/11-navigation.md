# Navigation Override System

The Admin shell navigation is driven by `IAdminSection` registrations from each module.
The rendering order and item placement can be overridden persistently
via the layered override model described below.

---

## Implementing `IAdminSection`

Every module that wants a navigation group in the Admin shell implements `IAdminSection`:

```csharp
public sealed class MyAdminSection : IAdminSection
{
    // Stable lower-kebab-case key — MUST be unique across all modules.
    public string Key   => "my-module";
    public string Title => "My Module";
    public string Icon  => Icons.Material.Filled.Extension;
    public int    Order => 50;

    public IReadOnlyList<AdminNavItem> NavItems =>
    [
        new("Overview",  "/admin/my-module",          Icons.Material.Filled.Dashboard),
        new("Settings",  "/admin/my-module/settings", Icons.Material.Filled.Settings),
    ];
}
```

### `Key` convention

- Lower-kebab-case, e.g. `"auth"`, `"storage"`, `"my-module"`.
- Must remain stable across refactors — it is the persistence key in the override store.
- Never use `Type.FullName` or any string that changes when you rename a class.

### `Order`

Determines the **default** sort order. Admins can override this via the navigation editor
(`/admin/navigation`). Lower values appear first.

---

## Override Model

The override store is persisted as JSON under the SDK-Settings key `admin.nav.overrides`.

### JSON schema

```json
{
  "version": 1,
  "sectionOverrides": [
    {
      "key": "auth",
      "displayTitle": null,
      "displayIcon": null,
      "order": 5,
      "isHidden": false
    }
  ],
  "itemOverrides": [
    {
      "href": "/admin/users/roles",
      "targetSectionKey": "settings",
      "order": null
    }
  ],
  "adminCreatedSections": [
    {
      "key": "acme-custom",
      "displayTitle": "Custom",
      "displayIcon": "Icons.Material.Filled.Star",
      "order": 99,
      "isHidden": false
    }
  ]
}
```

`null` fields mean "use code default". The serialiser omits `null` fields when writing.

### `sectionOverrides`

| Field | Effect |
|---|---|
| `key` | Matches `IAdminSection.Key` |
| `displayTitle` | Replaces the section title in the drawer |
| `displayIcon` | Replaces the section icon |
| `order` | Overrides the sort order |
| `isHidden` | `true` = section excluded from rendered nav |

### `itemOverrides`

Reassigns a nav item (identified by `href`) to a different section and/or sort position.

| Field | Effect |
|---|---|
| `href` | Stable route path — matches `AdminNavItem.Href` |
| `targetSectionKey` | Destination section `Key` (code section or admin-created) |
| `order` | Item sort position within the target section (`null` = list position) |

**Orphan handling:** if `targetSectionKey` does not exist in the resolved section list,
the item falls back to its code-default section and a warning is logged.

### `adminCreatedSections`

Sections that have no code `IAdminSection` backing. Used to create grouping containers
for reassigned items.

---

## `IAdminNavigationService`

`Admin.Contracts` exposes `IAdminNavigationService` for reading and writing the override store:

```csharp
public interface IAdminNavigationService
{
    IReadOnlyList<ResolvedAdminSection> GetResolvedNav(IServiceProvider services);
    NavOverrideStore GetStore();
    Task SaveStoreAsync(NavOverrideStore store);
}
```

The service is registered as `Scoped` by `AddBieberWorksAdmin()`.

`GetResolvedNav` applies the full pipeline:

1. Collect enabled `IAdminSection` instances.
2. Build `href → sectionKey` map from code defaults.
3. Apply `itemOverrides` — redirect hrefs to target sections.
4. Apply `sectionOverrides` — override title / icon / order / hidden per section.
5. Merge admin-created sections.
6. Sort sections by effective `Order`.
7. Sort items within each section by effective `Order`.
8. Detect orphan items (unknown target section) — fall back + warn.

`GetResolvedNav` returns **all** sections including hidden ones.
The `AdminLayout.razor` filters `IsHidden == true` before rendering.

---

## Multi-Shell Override Management

### Navigation Editor — `/admin/navigation`

The edit button (Tune icon) in the Admin drawer header navigates to `/admin/navigation`.
This page is implemented in `Admin.UI.MudBlazor`.

The editor discovers all registered `INavOverrideTarget` implementations via
`IEnumerable<INavOverrideTarget>` and renders one tab per shell (sorted by `ShellKey`).
Currently only the Admin shell is registered; a Phase 2 Account shell tab appears automatically
without any changes to the editor page.

Permission gate: `perm:admin:shell:access` (same as the Admin shell itself).

**Capabilities per shell tab:**

- Rename sections (display title override)
- Change section icon
- Change section sort order
- Hide/show sections
- Move nav items to a different section
- Change item sort order within a section
- Add admin-created sections (key + title + icon)
- Delete admin-created sections (items fall back to their original section)
- Reset to code defaults (clears the entire store)

### `INavOverrideTarget`

Defined in `Admin.Contracts`:

```csharp
public interface INavOverrideTarget
{
    string ShellKey { get; }        // e.g. "admin", "account"
    string DisplayName { get; }     // shown in editor tab

    IReadOnlyList<ShellNavSection> GetResolvedNav(IServiceProvider services);
    ShellNavOverrideStore GetStore();
    Task SaveStoreAsync(ShellNavOverrideStore store);
}
```

`AdminNavigationService` implements both `IAdminNavigationService` and `INavOverrideTarget`.
The factory registration avoids double instantiation:

```csharp
services.TryAddScoped<IAdminNavigationService, AdminNavigationService>();
services.TryAddScoped<INavOverrideTarget>(sp =>
    (INavOverrideTarget)sp.GetRequiredService<IAdminNavigationService>());
```

### Generic Shell DTOs (`Admin.Contracts/Navigation/`)

| Type | Purpose |
|---|---|
| `ShellNavSection` | Resolved section as shown to the editor (shell-agnostic) |
| `ShellNavItem` | Resolved nav item inside a `ShellNavSection` |
| `ShellNavOverrideStore` | Generic store passed between editor and `INavOverrideTarget` |
| `ShellNavSectionOverride` | Per-section override delta (title / icon / order / hidden) |
| `ShellNavItemOverride` | Item reassignment and order delta |
| `ShellCreatedSection` | Admin-created section with no code backing |

`ShellNavSection.Metadata` is an optional informational field (e.g. `"perm:storage:file:read"`)
displayed as a tooltip in the editor. It is not enforced.

### Adding a new shell (Phase 2+)

1. Implement `INavOverrideTarget` on your shell navigation service.
2. Register it: `services.TryAddScoped<INavOverrideTarget>(sp => ...)`.
3. The `/admin/navigation` editor tab appears automatically.

---

## Without SDK-Settings

If `ISettingsService` is not registered, `GetResolvedNav` returns the code-default
order with no overrides applied. No exception is thrown.
