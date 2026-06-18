# SDK-UI

Das Modul `SDK-UI` stellt die gemeinsame UI-Infrastruktur für alle BieberWorks-Shells bereit: Theming, Dark-Mode, AppBar-Widgets, Cookie-Consent, Viewport-Breakpoints und die responsive Shell-Basis `BwShellLayout`.

## Pakete

| Paket | Inhalt |
|---|---|
| `BieberWorks.SDK.UI.Contracts` | Interfaces ohne MudBlazor-Abhängigkeit: `IThemeService`, `ILayoutThemeContext`, `ILayoutThemeProvider`, `LayoutThemeData`, `IAppBarWidget`, `ICookieConsentService`, `IComponentOverrideRegistry`, `BwViewportInfo` |
| `BieberWorks.SDK.UI.MudBlazor` | Implementierungen und Razor-Komponenten: `BwThemeProvider`, `DarkModeToggle`, `LanguageSwitcher`, `BwAppBar`, `BwShellLayout`, `BwViewport`, `CookieBanner` |

## Wann dieses Modul verwenden?

- Immer, wenn ein Host `AdminLayout`, `AccountLayout` oder eine eigene Shell nutzt — beide bauen auf `BwShellLayout` auf.
- Für `DarkModeToggle` oder `LanguageSwitcher` in der AppBar.
- Wenn Fachmodule per `IAppBarWidget` eigene Widgets in die AppBar einklinken sollen.
- Für layout-abhängiges Theming über `ILayoutThemeContext` / `ILayoutThemeProvider` (z. B. SDK-Theme).
- Wenn Seiten responsive auf Breakpoints reagieren müssen (`BwViewportInfo` als `[CascadingParameter]`).

::: info Paket-Split
Fachmodule, die nur `IAppBarWidget` implementieren oder `BwViewportInfo` empfangen, brauchen ausschließlich `BieberWorks.SDK.UI.Contracts`. `BieberWorks.SDK.UI.MudBlazor` ist nur für den Host notwendig.
:::

## Versions-Referenz

Aktuelle stabile Version: **v0.3.0**

Paket-IDs: `BieberWorks.SDK.UI.Contracts` und `BieberWorks.SDK.UI.MudBlazor`.
