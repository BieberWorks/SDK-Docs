# SDK-Account

The module `SDK-Account` provides a self-service shell for logged-in users ("My Account"). The concept is analogous to SDK-Admin: domain modules plug in via `IAccountSection`.

## Packages

| Package | Contents |
|---|---|
| `BieberWorks.SDK.Account.Contracts` | `IAccountPage`, `IAccountSection`, `AccountNavItem`, `IAccountNavigationService` and related navigation types |
| `BieberWorks.SDK.Account` | `AccountModule` (`IModule` + `IEndpointModule` + `IModuleInitializer`), `AccountDbContext` (schema `"account"`), `IAccountNavigationService` impl, `AddBieberWorksAccount()`. Requires `DefaultConnection`. |
| `BieberWorks.SDK.Account.UI.Blazor.MudBlazor` | `AccountLayout`, `AccountShell`, `AccountUiMudBlazorModule`. UI skin only. `AddBieberWorksAccountUi()` registers MudBlazor services. |

The host must reference **both** `BieberWorks.SDK.Account` and `BieberWorks.SDK.Account.UI.Blazor.MudBlazor`. `AddBieberWorksModules(config)` discovers `AccountModule` from the impl package and `AccountUiMudBlazorModule` from the skin automatically.

## AccountShell concept

`AccountLayout` is a MudBlazor `LayoutComponentBase` using `BwShellLayout` (from SDK-UI) as responsive base. It:

- renders all registered `IAccountSection` implementations as `MudNavGroup` in the drawer via `IAccountNavigationService`,
- supports optional permission checks per section via `IAccountSection.RequiredPermission` (policy format `perm:{key}`),
- renders all registered `IAppBarWidget` instances (from SDK-UI) in the AppBar,
- sets the layout theme key to `"account"` via `ILayoutThemeContext`.

`AccountShell` is a light wrapper that wraps `AccountLayout` as `ChildContent` — useful as `DefaultLayout` in a Blazor router scope.

::: info Difference from AdminLayout
`AccountLayout` does not protect the body globally via policy — all content is visible as long as no `RequiredPermission` is set on the section. Individual sections can optionally be hidden per permission. `AdminLayout`, on the other hand, protects the entire area via `perm:admin:shell:access`.
:::

## Version reference

The latest stable release and full version history are on the [GitHub Releases page](https://github.com/BieberWorks/SDK-Account/releases).

## Documentation

| Topic | Document |
|---|---|
| NuGet references, `Program.cs`, `Routes.razor`, `IModule`-based setup | [Setup & Configuration](setup.md) |
| Navigation override system, `IAccountNavigationService`, resolve pipeline | [Navigation Overrides](navigation.md) |
| Implementing `IAccountSection` / `IAccountPage`, permission gating, feature flags | [Custom Pages & Sections](custom-pages.md) |
| Release history | [Changelog](CHANGES.md) |
