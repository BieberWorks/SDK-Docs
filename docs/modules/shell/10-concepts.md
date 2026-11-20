# Core Concepts

## `IShellSection`

Namespace `BieberWorks.SDK.Shell.Contracts`. The extension point every module implements to
contribute a navigation group to a shell:

```csharp
public interface IShellSection
{
    string Key { get; }
    string Title { get; }
    string Icon { get; }
    int Order { get; }
    IReadOnlyList<ShellNavItem> NavItems { get; }

    string? RequiredPermission => null;             // default interface member
    bool IsEnabled(IServiceProvider services) => true; // default interface member
}
```

- **`Key`** — Stable lower-kebab-case identifier (e.g. `"auth"`, `"storage"`). Used as the
  persistence key in the override store. Must be unique within the shell it belongs to.
- **`Title`** — Display name shown in the navigation drawer.
- **`Icon`** — A `BwIcon` token, not a MudBlazor `Icons.Material.*` constant directly. Resolved
  at render time (see [Icon resolution](#icon-resolution) below).
- **`Order`** — Default sort position; lower values render first. Overridable per shell via
  the nav editor.
- **`NavItems`** — The section's links, as `ShellNavItem` records.
- **`RequiredPermission`** — Optional permission key gating the whole section. `null` (the
  default) means no check. Enforced uniformly by `IShellNavigationService<TMarker>` via the
  `permissionChecker` callback passed to `AddBwShell<TMarker>`.
- **`IsEnabled(IServiceProvider)`** — Runtime visibility guard (feature flags, tenant checks,
  etc.). Returns `true` by default.

## `ShellNavItem`

A single link within a section:

```csharp
public sealed record ShellNavItem
{
    public required string Title { get; init; }
    public required string Href { get; init; }
    public required string Icon { get; init; }
}
```

`Href` is the stable identifier used by item-level overrides (reassigning an item to a
different section).

## `ShellDefinition`

Describes one registered shell as a whole:

```csharp
public sealed record ShellDefinition(string Key, string RoutePrefix, string DisplayName)
{
    public string? RequiredPermission { get; init; }
}
```

- **`Key`** — Stable identifier for the shell (e.g. `"admin"`, `"account"`). Used to derive the
  override-store persistence key: `$"{Key}.nav.overrides"`.
- **`RoutePrefix`** — Base route, e.g. `"/admin"`. Informational; not enforced by the kernel.
- **`DisplayName`** — Human-readable label, shown as the tab title in the multi-shell editor.
- **`RequiredPermission`** — Optional shell-wide permission gate.

## The Marker Pattern

Every shell defines its own empty marker interface deriving from `IShellSection`:

```csharp
public interface IAdminSection : IShellSection { }
public interface IAccountSection : IShellSection { }
```

Sections implement the marker of the shell they belong to (not `IShellSection` directly), and
`AddBwShell<TMarker>` resolves only `IEnumerable<TMarker>` from DI. This keeps shells isolated:
an `IAdminSection` registration is never visible to the Account shell's navigation service, even
though both share the exact same resolve pipeline and persistence mechanism.

## Override Store

`ShellNavOverrideStore` is the persisted document for one shell:

```csharp
public sealed record ShellNavOverrideStore(
    IReadOnlyList<NavSectionOverride> SectionOverrides,
    IReadOnlyList<NavItemOverride> ItemOverrides,
    IReadOnlyList<ShellCreatedSection> CreatedSections);
```

- **`NavSectionOverride(Key, DisplayTitle, DisplayIcon, Order, IsHidden)`** — per-section delta;
  `null` fields mean "use the code default".
- **`NavItemOverride(Href, TargetSectionKey, Order)`** — reassigns an item (by `Href`) to a
  different section and/or overrides its order within that section.
- **`ShellCreatedSection(Key, DisplayTitle, DisplayIcon, Order, IsHidden)`** — a section that
  exists only in the store, with no backing `IShellSection` — used as a grouping container for
  reassigned items.

The default persistence implementation, `SettingsShellNavOverrideStore`, stores one JSON
document per shell under the SDK-Settings key `{shellKey}.nav.overrides`. Without SDK-Settings
registered, `Load` returns `ShellNavOverrideStore.Empty` and code defaults are used — no
exception is thrown.

## Resolve Pipeline

`ShellNavResolver.Resolve` merges code-registered sections with the override store:

1. Filter sections by `IsEnabled` and `RequiredPermission`.
2. Deduplicate accidental duplicate `Key` registrations (first wins, warning logged).
3. Build the default `Href → sectionKey` map.
4. Apply `ItemOverrides` — redirect items to other sections.
5. Apply `SectionOverrides` — title / icon / order / hidden.
6. Merge `CreatedSections`.
7. Detect orphan items (unknown target section) — fall back to the item's original section and
   log a warning.
8. Sort sections and items by effective `Order`.

The result, `IReadOnlyList<ResolvedShellSection>`, **includes hidden sections**; callers that
render navigation (such as `BwShellLayoutBase<TMarker>`) filter `IsHidden == true` themselves.

## Icon Resolution

`IShellSection.Icon`, `ShellNavItem.Icon`, and all resolved-DTO icon fields are opaque `BwIcon`
string tokens, not MudBlazor `Icons.Material.*` values directly. They are resolved to concrete
icons at render time via `IShellIconResolver` (`BieberWorks.SDK.UI.Contracts.Icons`), which
`BwShellLayoutBase<TMarker>` injects and calls (`IconResolver.Resolve(section.Icon)`). This
keeps `Shell.Contracts` free of any UI-framework-specific icon dependency.
