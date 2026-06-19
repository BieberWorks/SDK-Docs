# SDK-Account

The module `SDK-Account` provides a self-service shell for logged-in users ("My Account"). The concept is analogous to SDK-Admin: domain modules plug in via `IAccountSection`.

## Packages

| Package | Contents |
|---|---|
| `BieberWorks.SDK.Account.Contracts` | `IAccountPage`, `IAccountSection`, `AccountNavItem` |
| `BieberWorks.SDK.Account.UI.MudBlazor` | `AccountLayout`, `AccountShell`, `AccountModule` (`IModule` + `IEndpointModule`), `AddBieberWorksAccount()` |

## AccountShell concept

`AccountLayout` is a MudBlazor `LayoutComponentBase` using `BwShellLayout` (from SDK-UI) as responsive base. It:

- renders all registered `IAccountSection` implementations as `MudNavGroup` in the drawer,
- supports optional permission checks per section via `IAccountSection.RequiredPermission` (policy format `perm:{key}`),
- renders all registered `IAppBarWidget` instances (from SDK-UI) in the AppBar,
- sets the layout theme key to `"account"` via `ILayoutThemeContext`.

`AccountShell` is a light wrapper that wraps `AccountLayout` as `ChildContent` — useful as `DefaultLayout` in a Blazor router scope.

::: info Difference from AdminLayout
`AccountLayout` does not protect the body globally via policy — all content is visible as long as no `RequiredPermission` is set on the section. Individual sections can optionally be hidden per permission. `AdminLayout`, on the other hand, protects the entire area via `perm:admin:shell:access`.
:::

## Version reference

Current stable version: **v0.5.0**

Package IDs: `BieberWorks.SDK.Account.Contracts` and `BieberWorks.SDK.Account.UI.MudBlazor`.

## Further Reading

- [Setup & Configuration](./setup.md)
- [Custom Pages & Sections](./custom-pages.md)
