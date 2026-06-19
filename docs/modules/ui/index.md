# SDK-UI

The module `SDK-UI` provides shared UI infrastructure for all BieberWorks shells: theming, dark mode, AppBar widgets, cookie consent, viewport breakpoints, and the responsive shell base `BwShellLayout`.

## Packages

| Package | Contents |
|---|---|
| `BieberWorks.SDK.UI.Contracts` | Interfaces without MudBlazor dependency: `IThemeService`, `ILayoutThemeContext`, `ILayoutThemeProvider`, `LayoutThemeData`, `IAppBarWidget`, `ICookieConsentService`, `IComponentOverrideRegistry`, `BwViewportInfo` |
| `BieberWorks.SDK.UI.MudBlazor` | Implementations and Razor components: `BwThemeProvider`, `DarkModeToggle`, `LanguageSwitcher`, `BwAppBar`, `BwShellLayout`, `BwViewport`, `CookieBanner` |

## When to use this module?

- Always when a host uses `AdminLayout`, `AccountLayout`, or its own shell — both are built on `BwShellLayout`.
- For `DarkModeToggle` or `LanguageSwitcher` in the AppBar.
- When domain modules want to plug in custom widgets via `IAppBarWidget`.
- For layout-dependent theming via `ILayoutThemeContext` / `ILayoutThemeProvider` (e.g. SDK-Theme).
- When pages need to respond to breakpoints (`BwViewportInfo` as `[CascadingParameter]`).

::: info Package split
Domain modules that only implement `IAppBarWidget` or receive `BwViewportInfo` need only `BieberWorks.SDK.UI.Contracts`. `BieberWorks.SDK.UI.MudBlazor` is only needed by the host.
:::

## Version reference

Current stable version: **v0.8.0**

Package IDs: `BieberWorks.SDK.UI.Contracts` and `BieberWorks.SDK.UI.MudBlazor`.
