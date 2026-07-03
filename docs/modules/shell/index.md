# Shell

The generic shell navigation kernel for the BieberWorks SDK. Provides discovery, resolve,
navigation-override persistence, a layout base, and a multi-shell nav editor — built once,
reused by every shell (Admin, Account, and any consumer shell) instead of duplicating
navigation logic per module.

## Packages

| Package | Contents |
|---|---|
| `BieberWorks.SDK.Shell.Contracts` | `IShellSection`, `ShellNavItem`, `ShellDefinition`, `IShellRegistry`, `IShellNavigationService<TMarker>`, `INavOverrideTarget`, `ShellNavOverrideStore` and related override/resolve DTOs. MudBlazor-free, dependency-free except `BieberWorks.SDK.UI.Contracts`. |
| `BieberWorks.SDK.Shell` | `AddBwShell<TMarker>()`, the resolve pipeline (`ShellNavResolver`), `ShellRegistry`, and the settings-backed `SettingsShellNavOverrideStore`. |
| `BieberWorks.SDK.Shell.UI.Blazor` | Thin Razor class library layer between Contracts and the MudBlazor skin. No components of its own yet. |
| `BieberWorks.SDK.Shell.UI.Blazor.MudBlazor` | `BwShellLayoutBase<TMarker>` (generic layout wrapping SDK-UI's `BwShellLayout`), `BwShellNavEditor` and `BwNavShellEditorPanel` (multi-shell nav override editor). |

A shell host references `BieberWorks.SDK.Shell.Contracts`, `BieberWorks.SDK.Shell`, and
`BieberWorks.SDK.Shell.UI.Blazor.MudBlazor` (transitively pulls in `UI.Blazor`).

## Architecture

`Shell.Contracts` is Tier 1 (only depends on `BieberWorks.SDK.UI.Contracts`, itself MudBlazor-free).
`Shell` depends only on `Shell.Contracts` plus `BieberWorks.SDK.Core` and
`BieberWorks.SDK.Settings.Contracts` — no dependency on any concrete shell such as Admin or
Account. The dependency direction is always **Shell → SDK-UI**, never the reverse: Admin,
Account, and consumer shells depend on Shell, not the other way around.

## When to use this

Use SDK-Shell whenever a new module needs its own navigation area (a "shell") with sections
contributed by other modules — for example the Admin area, the Account area, or a bespoke
customer-facing portal. Implement a marker interface, call `AddBwShell<TMarker>()`, and every
consumer of that marker gets discovery, override persistence, and an editor tab for free.

## Version

See the [GitHub Releases page](https://github.com/BieberWorks/SDK-Shell/releases) for the
latest stable version and changelog.

## Documentation

| Topic | File |
|---|---|
| Core concepts (`IShellSection`, override model, icons) | [10-concepts.md](./10-concepts.md) |
| Registering a shell (`AddBwShell<TMarker>`) | [20-registering-a-shell.md](./20-registering-a-shell.md) |
| Implementing sections | [30-implementing-sections.md](./30-implementing-sections.md) |
| The multi-shell navigation editor | [40-navigation-editor.md](./40-navigation-editor.md) |
| Building a custom consumer shell (flagship example) | [50-custom-shell.md](./50-custom-shell.md) |
| Changelog | [90-changelog.md](./90-changelog.md) |
