# Navigation Override System

The Admin shell navigation is driven by `IAdminSection` registrations from each module.
`IAdminSection` (in `Admin.Contracts`) is an empty marker interface over
`BieberWorks.SDK.Shell.Contracts.IShellSection` — all navigation machinery (the resolve
pipeline, the override store, the editor) is implemented once, generically, in the
**SDK-Shell** module and shared across every shell (Admin, Account, and future shells).
This page summarizes the Admin-specific wiring. See the SDK-Shell docs for the full
navigation/override reference.

---

## Implementing `IAdminSection`

`IShellSection` and `ShellNavItem` live in `BieberWorks.SDK.Shell.Contracts`.
`IAdminSection` lives in `BieberWorks.SDK.Admin.Contracts` and scopes registrations to the
Admin shell:

```csharp
public interface IAdminSection : BieberWorks.SDK.Shell.Contracts.IShellSection
{
}
```

Every module that wants a navigation group in the Admin shell implements `IAdminSection`:

```csharp
using BieberWorks.SDK.Admin.Contracts;
using BieberWorks.SDK.Shell.Contracts;

public sealed class MyAdminSection : IAdminSection
{
    // Stable lower-kebab-case key — MUST be unique across all modules registered in this shell.
    public string Key   => "my-module";
    public string Title => "My Module";
    public string Icon  => Icons.Material.Filled.Extension;
    public int    Order => 50;

    public IReadOnlyList<ShellNavItem> NavItems =>
    [
        new ShellNavItem { Title = "Overview", Href = "/admin/my-module",          Icon = Icons.Material.Filled.Dashboard },
        new ShellNavItem { Title = "Settings", Href = "/admin/my-module/settings", Icon = Icons.Material.Filled.Settings },
    ];
}
```

Registration: `services.AddSingleton<IAdminSection, MyAdminSection>()`.

### `Key` convention

- Lower-kebab-case, e.g. `"auth"`, `"storage"`, `"my-module"`.
- Must remain stable across refactors — it is the persistence key in the override store.
- Never use `Type.FullName` or any string that changes when you rename a class.

### `Order`

Determines the **default** sort order. Admins can override this via the navigation editor
(`/admin/navigation`). Lower values appear first.

---

## Override Model (implemented in SDK-Shell)

The override store is persisted as JSON under the SDK-Settings key `admin.nav.overrides`
(derived from the shell's `Key`, `"admin"`, via `ShellDefinition`).

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
| `key` | Matches `IAdminSection.Key` (inherited from `IShellSection.Key`) |
| `displayTitle` | Replaces the section title in the drawer |
| `displayIcon` | Replaces the section icon |
| `order` | Overrides the sort order |
| `isHidden` | `true` = section excluded from rendered nav |

### `itemOverrides`

Reassigns a nav item (identified by `href`) to a different section and/or sort position.

| Field | Effect |
|---|---|
| `href` | Stable route path — matches `ShellNavItem.Href` |
| `targetSectionKey` | Destination section `Key` (code section or admin-created) |
| `order` | Item sort position within the target section (`null` = list position) |

**Orphan handling:** if `targetSectionKey` does not exist in the resolved section list,
the item falls back to its code-default section and a warning is logged.

### `adminCreatedSections`

Sections that have no code `IAdminSection` backing. Used to create grouping containers
for reassigned items.

---

## `IShellNavigationService<IAdminSection>`

The Admin shell resolves navigation via the generic
`IShellNavigationService<TMarker>` (SDK-Shell), registered by
`services.AddBwShell<IAdminSection>(...)` inside `AddBieberWorksAdmin()`:

```csharp
public interface IShellNavigationService<TMarker> where TMarker : IShellSection
{
    IReadOnlyList<ResolvedShellSection> GetResolvedNav(IServiceProvider services);
    ShellNavOverrideStore GetStore();
    Task SaveStoreAsync(ShellNavOverrideStore store);
}
```

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
`BwShellLayoutBase<IAdminSection>` (which `AdminLayout` builds on) filters `IsHidden == true`
before rendering.

---

## Multi-Shell Override Management

### Navigation Editor — `/admin/navigation`

The edit button (Tune icon) in the Admin drawer header navigates to `/admin/navigation`.
This page hosts the generic **`BwShellNavEditor`** component from
`BieberWorks.SDK.Shell.UI.Blazor.MudBlazor`.

`BwShellNavEditor` discovers all registered `INavOverrideTarget` implementations via
`IEnumerable<INavOverrideTarget>` (SDK-Shell) and renders one tab per shell (sorted by
`ShellKey`). Every shell registered via `AddBwShell<TMarker>()` — Admin, Account, and any
future shell — automatically gets a tab here, with zero changes to this page.

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

Defined in `BieberWorks.SDK.Shell.Contracts.Navigation`:

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

`AddBwShell<TMarker>()` registers the concrete `IShellNavigationService<TMarker>` and
additionally exposes it as `INavOverrideTarget` — no manual wiring needed in Admin or any
other shell module:

```csharp
services.TryAddScoped<IShellNavigationService<TMarker>>(sp => /* ... */);
services.AddScoped<INavOverrideTarget>(sp =>
    (INavOverrideTarget)sp.GetRequiredService<IShellNavigationService<TMarker>>());
```

### Generic Shell DTOs (`BieberWorks.SDK.Shell.Contracts.Navigation`)

| Type | Purpose |
|---|---|
| `ShellNavSection` | Resolved section as shown to the editor (shell-agnostic) |
| `ShellNavItem` (Navigation namespace) | Resolved nav item inside a `ShellNavSection` |
| `ShellNavOverrideStore` | Generic store passed between editor and `INavOverrideTarget` |
| `NavSectionOverride` | Per-section override delta (title / icon / order / hidden) |
| `NavItemOverride` | Item reassignment and order delta |
| `ShellCreatedSection` | Admin-created section with no code backing |

`ShellNavSection.Metadata` is an optional informational field (e.g. `"perm:storage:file:read"`)
displayed as a tooltip in the editor. It is not enforced.

### Adding a new shell

1. Call `services.AddBwShell<TMarker>(new ShellDefinition(key, routePrefix, displayName), permissionChecker)`
   in the new module's registration extension, where `TMarker` is a fresh marker interface
   deriving from `IShellSection` (mirroring `IAdminSection`/`IAccountSection`).
2. `AddBwShell` registers `IShellNavigationService<TMarker>` and `INavOverrideTarget` automatically.
3. The `/admin/navigation` editor (`BwShellNavEditor`) shows a new tab for the shell automatically.

---

## Without SDK-Settings

If `ISettingsService` is not registered, `GetResolvedNav` returns the code-default
order with no overrides applied. No exception is thrown.
