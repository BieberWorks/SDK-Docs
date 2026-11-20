# Implementing Sections

A section is a plain class implementing the shell's marker interface (which derives from
`IShellSection`):

```csharp
using BieberWorks.SDK.Shell.Contracts;

internal sealed class InvoicesAdminSection : IAdminSection
{
    public string Key   => "invoices";
    public string Title => "Invoices";
    public string Icon  => BwIcon.Receipt;
    public int    Order => 40;

    public IReadOnlyList<ShellNavItem> NavItems =>
    [
        new ShellNavItem { Title = "All invoices", Href = "/admin/invoices",          Icon = BwIcon.List },
        new ShellNavItem { Title = "Settings",      Href = "/admin/invoices/settings", Icon = BwIcon.Settings },
    ];
}
```

Register it as a singleton against the shell's marker:

```csharp
services.AddSingleton<IAdminSection, InvoicesAdminSection>();
```

Use `AddSingleton` (not `AddScoped`) unless the section genuinely needs per-request state —
`NavItems` should be static, code-defined data. `IsEnabled` and `RequiredPermission` are
evaluated per-request against the resolved `IServiceProvider`, so runtime conditionals don't
require the section instance itself to be scoped.

## `Key` convention

- Lower-kebab-case, e.g. `"auth"`, `"storage"`, `"invoices"`.
- Must remain stable across refactors — it is the persistence key referenced by
  `NavSectionOverride.Key` and `NavItemOverride.TargetSectionKey` in the override store. Renaming
  a section's `Key` orphans any existing overrides pointing at it.
- Never derive it from `Type.FullName` or any string that changes when the class is renamed.
- Must be unique within the shell (marker) it's registered against. Duplicate keys within the
  same shell are deduplicated at resolve time (first registration wins) with a warning logged.

## `Order`

Determines the section's default sort position; lower values render first. This is only the
**code default** — an admin can override it per shell via the navigation editor
(see [40-navigation-editor.md](./40-navigation-editor.md)) without touching code.

## `IsEnabled(IServiceProvider)`

Override to hide a section based on runtime conditions such as feature flags or tenant state:

```csharp
public bool IsEnabled(IServiceProvider services)
{
    var flags = services.GetRequiredService<IFeatureFlagService>();
    return flags.IsEnabled("invoices-module");
}
```

Returns `true` by default (the interface has a default implementation), so most sections don't
need to implement this member at all.

## `RequiredPermission`

Override to gate the entire section behind a permission key, enforced by the
`permissionChecker` callback passed to `AddBwShell<TMarker>`:

```csharp
public string? RequiredPermission => "invoices:admin:access";
```

Returns `null` by default (no check). If the shell was registered without a `permissionChecker`,
`RequiredPermission` is ignored and the section is always visible regardless of its value.

## Item-level `Href` stability

`ShellNavItem.Href` is the stable key used by `NavItemOverride` to reassign an item to a
different section. Keep route paths stable across refactors for the same reason as `Key` —
changing a route in a way that also changes `Href` orphans any override that targets it (the
item falls back to its section's code default and a warning is logged; nothing crashes).
