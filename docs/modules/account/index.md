# Account

The module `SDK-Account` provides a self-service shell for logged-in users ("My Account"). The concept is analogous to SDK-Admin: both build on the shared **SDK-Shell** navigation kernel, and domain modules plug into Account via `IAccountSection`.

## Packages

| Package | Contents |
|---|---|
| `BieberWorks.SDK.Account.Contracts` | `IAccountPage`, `IAccountSection` (empty marker over `BieberWorks.SDK.Shell.Contracts.IShellSection`) |
| `BieberWorks.SDK.Account` | `AccountModule` (`IModule` + `IEndpointModule` + `IModuleInitializer`), `AccountDbContext` (schema `"account"`), `AddBieberWorksAccount()` (registers the Account shell via `AddBwShell<IAccountSection>()`). Requires `DefaultConnection`. |
| `BieberWorks.SDK.Account.UI.Blazor.MudBlazor` | `AccountLayout`, `AccountShell`, `AccountUiMudBlazorModule`. UI skin only. `AddBieberWorksAccountUi()` registers MudBlazor services. |

The host must reference **both** `BieberWorks.SDK.Account` and `BieberWorks.SDK.Account.UI.Blazor.MudBlazor`. `AddBieberWorksModules(config)` discovers `AccountModule` from the impl package and `AccountUiMudBlazorModule` from the skin automatically.

::: info Depends on SDK-Shell
Account does **not** reference `Admin.Contracts`. Both shells are independent consumers of the standalone **SDK-Shell** module (`BieberWorks.SDK.Shell.Contracts` / `.Shell` / `.Shell.UI.Blazor.MudBlazor(.MudBlazor)`), which owns `IShellSection`, `ShellNavItem`, `IShellNavigationService<TMarker>`, the override model, and the navigation editor component. `IAccountSection` is Account's marker over `IShellSection`, exactly as `IAdminSection` is Admin's.
:::

## AccountShell concept

`AccountLayout` builds on `BwShellLayoutBase<IAccountSection>` (from SDK-Shell's MudBlazor skin), which itself wraps `BwShellLayout` (from SDK-UI) as responsive base. It:

- renders all registered `IAccountSection` implementations as `MudNavGroup` in the drawer via `IShellNavigationService<IAccountSection>`,
- supports optional permission checks per section via `IAccountSection.RequiredPermission` (inherited from `IShellSection`, policy format `perm:{key}`),
- renders all registered `IAppBarWidget` instances (from SDK-UI) in the AppBar,
- sets the layout theme key to `"account"` via `ILayoutThemeContext`.

`AccountShell` is a light wrapper that wraps `AccountLayout` as `ChildContent` — useful as `DefaultLayout` in a Blazor router scope.

::: info Difference from AdminLayout
`AccountLayout` does not protect the body globally via policy — all content is visible as long as no `RequiredPermission` is set on the section. Individual sections can optionally be hidden per permission. `AdminLayout`, on the other hand, protects the entire area via `perm:admin:shell:access` (set as the Admin shell's `ShellDefinition.RequiredPermission`). Both marker interfaces (`IAdminSection`, `IAccountSection`) are otherwise identical thin markers over `IShellSection`.
:::

## Version reference

The latest stable release and full version history are on the [GitHub Releases page](https://github.com/BieberWorks/SDK-Account/releases).

## Documentation

| Topic | Document |
|---|---|
| NuGet references, `Program.cs`, `Routes.razor`, `IModule`-based setup | [Setup & Configuration](01-getting-started.md) |
| Navigation override system, `IShellNavigationService<IAccountSection>`, resolve pipeline | [Navigation Overrides](10-navigation.md) |
| Implementing `IAccountSection` / `IAccountPage`, permission gating, feature flags | [Custom Pages & Sections](11-custom-pages.md) |
| Release history | [Changelog](90-changelog.md) |
