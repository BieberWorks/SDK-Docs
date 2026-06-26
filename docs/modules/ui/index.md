# SDK-UI

The module `SDK-UI` provides shared UI infrastructure for all BieberWorks shells: theming, dark mode, AppBar widgets, cookie consent, viewport breakpoints, timezone display, and the responsive shell base `BwShellLayout`.

## Packages

| Package | Contents |
|---|---|
| `BieberWorks.SDK.UI.Contracts` | Interfaces without MudBlazor dependency: `IThemeService`, `ILayoutThemeContext`, `ILayoutThemeProvider`, `LayoutThemeData`, `IAppBarWidget`, `ICookieConsentService`, `ICookieRegistrationSource`, `IComponentOverrideRegistry`, `IUserTimeZoneAccessor`, `TimeZoneDisplayMode`, `BwViewportInfo` |
| `BieberWorks.SDK.UI.MudBlazor` | Implementations and Razor components: `BwThemeProvider`, `DarkModeToggle`, `LanguageSwitcher`, `BwAppBar`, `BwShellLayout`, `BwViewport`, `BwTime`, `CookieBanner`, `BwDataView<TItem>` (responsive declarative data view) |

## When to use this module?

- Always when a host uses `AdminLayout`, `AccountLayout`, or its own shell — both are built on `BwShellLayout`.
- For `DarkModeToggle` or `LanguageSwitcher` in the AppBar.
- When domain modules want to plug in custom widgets via `IAppBarWidget`.
- For layout-dependent theming via `ILayoutThemeContext` / `ILayoutThemeProvider` (e.g. SDK-Theme).
- When pages need to respond to breakpoints (`BwViewportInfo` as `[CascadingParameter]`).
- When timestamps should be displayed in UTC or the user's browser-local timezone via `BwTime` / `IUserTimeZoneAccessor`.

::: info Package split
Domain modules that only implement `IAppBarWidget`, `ICookieRegistrationSource`, or `IUserTimeZoneAccessor` need only `BieberWorks.SDK.UI.Contracts`. `BieberWorks.SDK.UI.MudBlazor` is only needed by the host.
:::

## Version reference

See the [Releases page](https://github.com/BieberWorks/SDK-UI/releases) for the current stable version.

Package IDs: `BieberWorks.SDK.UI.Contracts` and `BieberWorks.SDK.UI.MudBlazor`.

## Documentation

| Topic | Description |
|---|---|
| [Setup](setup.md) | NuGet references, `Program.cs` registration, `Routes.razor` wiring |
| [Components](components.md) | All components and contracts: `BwThemeProvider`, `ILayoutThemeContext`, `IThemeService`, `DarkModeToggle`, `LanguageSwitcher`, `IAppBarWidget`, `BwShellLayout`, `BwViewportInfo`, `ICookieConsentService`/`CookieBanner`, `IUserTimeZoneAccessor`/`BwTime`, Component Override System, `BwDataView<TItem>` |
