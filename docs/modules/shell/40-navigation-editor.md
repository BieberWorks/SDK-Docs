# Navigation Editor

## `BwShellNavEditor`

`BieberWorks.SDK.Shell.UI.Blazor.MudBlazor` ships a self-contained, multi-shell navigation
override editor:

```razor
@using BieberWorks.SDK.Shell.UI.Blazor.MudBlazor.Components

<BwShellNavEditor />
```

It injects `IEnumerable<INavOverrideTarget>` and renders one tab per distinct `ShellKey`,
sorted alphabetically:

- **Zero targets** — shows an info alert (`NoTargetsContent` parameter overrides it).
- **One target** — renders `BwNavShellEditorPanel` directly, no tabs.
- **Multiple targets** — renders a `MudTabs` with one `MudTabPanel` per shell, `Text` bound to
  `INavOverrideTarget.DisplayName`.

Every shell registered via `AddBwShell<TMarker>` automatically exposes an `INavOverrideTarget`
(the same instance backing `IShellNavigationService<TMarker>`), so **a new shell's editor tab
appears with zero changes to `BwShellNavEditor` or the host page** — just call `AddBwShell` for
it.

### `OnShellSaved`

```razor
<BwShellNavEditor OnShellSaved="HandleShellSaved" />
```

```csharp
private Task HandleShellSaved(INavOverrideTarget target)
{
    // e.g. invalidate a cache, show a toast naming target.DisplayName
    return Task.CompletedTask;
}
```

Raised after any shell tab's overrides are saved, passing the affected `INavOverrideTarget`.

## Hosting the editor

The kernel does not mount a route for the editor — the host shell decides where to expose it.
SDK-Admin, for example, hosts it at `/admin/navigation` behind its
`admin:shell:access` permission. A custom consumer shell can host it anywhere, or omit it
entirely if navigation overrides aren't needed for that shell.

## Editor capabilities (per shell tab)

Backed by `BwNavShellEditorPanel`, operating on one shell's `ShellNavOverrideStore` via its
`INavOverrideTarget`:

- Rename sections (`NavSectionOverride.DisplayTitle`)
- Change section icon (`DisplayIcon`)
- Change section sort order (`Order`)
- Hide/show sections (`IsHidden`)
- Reassign nav items to a different section (`NavItemOverride.TargetSectionKey`)
- Change item sort order within a section (`NavItemOverride.Order`)
- Add shell-created sections with no code backing (`ShellCreatedSection`)
- Delete shell-created sections (items assigned to them fall back to their original section)
- Reset to code defaults (saves `ShellNavOverrideStore.Empty`)

## Persistence

Overrides are persisted per shell via `IShellNavOverrideStore` under the settings key
`{shellKey}.nav.overrides` (see [10-concepts.md](./10-concepts.md#override-store)). Saving from
the editor calls `INavOverrideTarget.SaveStoreAsync`, which delegates to
`IShellNavigationService<TMarker>.SaveStoreAsync` for the corresponding shell.
