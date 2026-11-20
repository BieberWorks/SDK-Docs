# Theme

The Theme module provides MudBlazor-based theming, branding, and visual customisation infrastructure for BieberWorks SDK hosts. It ships built-in colour presets, a full admin UI for creating custom presets, per-layout preset assignment, optional per-user theme preferences, and an SVG-driven branding pipeline that generates favicons, PWA icons, and email logos automatically.

## What the module offers

- **Built-in Presets** — three code-defined presets (`default`, `high-contrast`, `corporate-blue`); hosts can register additional presets via DI
- **Custom Preset Editor** — create, edit, delete, import, and export custom colour presets via the Admin UI at `/admin/theme`
- **Per-layout Preset Assignment** — any registered `IThemeableLayout` (main, admin, account, branding, or host-defined) can be assigned an independent preset
- **Per-user Theme Preferences** — optional; users can override the layout preset from their Account page when the `theme.userPreferences.enabled` feature flag is active
- **SVG Branding Pipeline** — upload BrandingLogo + BrandingIcon SVGs; the module rasterises all derived PNG assets (favicons, PWA icons, email logos) automatically via SkiaSharp, resolving `currentColor` against the active branding preset's Primary colour
- **`<BwFaviconLinks />`** — drop-in Razor component that injects `<link>` tags for all generated favicon/PWA assets
- **Branding Endpoints** — self-registers `/bw/branding/*` and `/favicon.ico`; `/bw/branding/site.webmanifest` is dynamically generated
- **`ILayoutThemeProvider`** adapter — exposes the active `ThemeConfiguration` to `SDK-UI` layouts without a direct dependency on Theme.Impl
- **No own DbContext** — all persistence is delegated to SDK-Settings (key/value) and SDK-Storage (binary assets)
- **Auto-Auditing** — preset and palette changes fire `IAuditableEvent`-implementing domain events picked up by SDK-Audit

## Package overview

| Package | Description | When needed |
|---|---|---|
| `BieberWorks.SDK.Theme.Contracts` | Interfaces, records, domain events, permission constants — no dependency on implementation | Always when another module or layout reads the active theme |
| `BieberWorks.SDK.Theme` | Full implementation: `ThemeService`, `ThemeAdminService`, `BrandingService`, SkiaSharp rasteriser, settings definitions, branding endpoints | In the host that provides the Theme feature |
| `BieberWorks.SDK.Theme.UI` | Abstract Blazor base classes for Admin and Account pages (framework-agnostic) | Transitively — referenced by `.UI.MudBlazor` |
| `BieberWorks.SDK.Theme.UI.MudBlazor` | Ready-made MudBlazor Razor pages (`/admin/theme`, `/admin/theme/branding`, `/account/theme`) and `<BwFaviconLinks />` | When using the built-in Theme pages in a Blazor Server / WASM host |

::: tip Versioning
All packages are released together and share one version, computed from Conventional Commits. The latest release and full history live on the [GitHub Releases page](https://github.com/BieberWorks/SDK-Theme/releases) (see [changelog](CHANGES.md)).
:::

## When to use which package

| Scenario | Required packages |
|---|---|
| A layout or module reads the active palette via `IThemeService` or `ILayoutThemeProvider` | `Theme.Contracts` |
| Host registers a custom colour preset or a custom `IThemeableLayout` | `Theme.Contracts` (implement and register in DI) |
| Host provides the full theme and branding feature | `Theme` + `Theme.UI.MudBlazor` |
| Host uses the built-in MudBlazor Admin/Account pages | `Theme.UI.MudBlazor` (pulls in `Theme.UI` transitively) |

## Documentation

| Topic | Document |
|---|---|
| Setup in `Program.cs`, `AddThemePreset`, `AddThemeableLayout`, `AddThemeUi`, `<BwFaviconLinks />` in Routes.razor, `<BwThemeProvider />` | [Setup & Configuration](setup.md) |
| Built-in and custom presets, `IThemeService`, `IThemeAdminService`, per-layout assignment, per-user preferences, import/export | [Theming](theming.md) |
| SVG authoring guidelines, asset matrix, `IBrandingService`, email branding, branding preset, Docker/Linux SkiaSharp requirements, migration from v1.x | [Branding](branding.md) |
| Release history | [Changelog](CHANGES.md) |
