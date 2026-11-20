# Branding

The module provides a full SVG-based branding pipeline. Upload a **BrandingLogo** SVG and a **BrandingIcon** SVG; the module generates all required PNG assets (favicons, Apple touch icon, PWA icons, email logos) automatically using the active theme palette.

---

## SVG Authoring Guidelines

### `currentColor` Usage

Use `currentColor` as fill/stroke colour. The rasterizer resolves `currentColor` to the active theme's **Primary** colour before rendering.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40">
  <rect fill="currentColor" x="0" y="0" width="100" height="40"/>
</svg>
```

### Limitation: CSS Custom Properties

`var(--mud-palette-primary)` and other CSS custom properties are **not** resolved in v1. Only the literal string `currentColor` is replaced. SVGs using CSS variables will render with a fallback colour (`#000000` light, `#ffffff` dark).

### BrandingLogo

- **Purpose:** AppBar display via `<BwLogo />`, email logo source.
- **Recommended aspect ratio:** 4:1 (e.g. 320×80 px viewport).
- **Content:** Logotype (wordmark + optional icon).

### BrandingIcon

- **Purpose:** Favicon, Apple touch icon, PWA manifest icons.
- **Recommended:** Square viewport with ~20% transparent safe-zone padding for maskable icon compliance.
- **Content:** Standalone symbol or abbreviated mark.

---

## Asset Matrix

| Asset | Source SVG | Size (px) | Palette | URL |
|---|---|---|---|---|
| Email Logo Light | BrandingLogo | 320×80 | Light | `/bw/branding/email-logo-light.png` |
| Email Logo Dark | BrandingLogo | 320×80 | Dark | `/bw/branding/email-logo-dark.png` |
| Favicon 16 | BrandingIcon | 16×16 | Light | `/bw/branding/favicon-16.png` |
| Favicon 32 | BrandingIcon | 32×32 | Light | `/bw/branding/favicon-32.png` |
| Apple Touch Icon | BrandingIcon | 180×180 | Light | `/bw/branding/apple-touch-icon.png` |
| PWA Icon 192 | BrandingIcon | 192×192 | Light | `/bw/branding/pwa-192.png` |
| PWA Icon 512 | BrandingIcon | 512×512 | Light | `/bw/branding/pwa-512.png` |
| PWA Maskable | BrandingIcon | 512×512 | Light | `/bw/branding/pwa-maskable.png` |

Assets regenerate automatically on SVG upload and on active preset or palette change.

---

## `favicon.ico`

`/favicon.ico` is served by the module and streams `favicon-32.png` with `Content-Type: image/x-icon`. All modern browsers accept PNG at this route. A multi-resolution ICO file is not generated.

---

## Host Integration

### Favicon Head Links — `<BwFaviconLinks />`

Place inside `<HeadContent>` in `Routes.razor`:

```razor
<HeadContent>
    <BwFaviconLinks />
</HeadContent>
```

Renders `<link>` tags only for assets that have been generated. No output if no icon SVG is uploaded.

### Branding Endpoints

The module self-registers all `/bw/branding/*` endpoints and `/favicon.ico` automatically via `IEndpointModule`.
`app.MapBieberWorksModules()` discovers and maps the endpoints — no manual call is required.

### `site.webmanifest`

Available at `/bw/branding/site.webmanifest`. Dynamically generated from the `app.name` setting and stored asset IDs.

---

## `IBrandingService` Reference

```csharp
// SVG source management
Task<SvgSource?>  GetLogoSvgAsync(CancellationToken ct = default);
Task<SvgSource?>  GetIconSvgAsync(CancellationToken ct = default);
Task UploadLogoSvgAsync(Stream content, string fileName, long sizeBytes, string? modifiedBy = null, CancellationToken ct = default);
Task UploadIconSvgAsync(Stream content, string fileName, long sizeBytes, string? modifiedBy = null, CancellationToken ct = default);
Task DeleteLogoSvgAsync(string? modifiedBy = null, CancellationToken ct = default);
Task DeleteIconSvgAsync(string? modifiedBy = null, CancellationToken ct = default);

// Derived assets
Task<BrandingAssetSet> GetDerivedAssetsAsync(CancellationToken ct = default);

// Head markup
Task<string> GetFaviconHeadMarkupAsync(CancellationToken ct = default);

// Email branding
Task<EmailBranding> GetEmailBrandingAsync(CancellationToken ct = default);
```

`EmailBranding` includes both light- and dark-mode logo URLs:

```csharp
public sealed record EmailBranding(
    string? LogoUrl,          // absolute, light-mode email logo
    string? LogoUrlDark,      // absolute, dark-mode email logo
    string? BrandColor,       // LightPalette.Primary (CSS hex)
    string? BrandColorDark,   // DarkPalette.Primary (CSS hex)
    string? AppName,
    string? BaseUrl);
```

---

## Branding Preset Assignment

Branding assets use their own dedicated preset slot — separate from the main, admin, and account layouts.

In the Admin UI under **Theme & Branding → Presets**, a **"Branding"** chip appears alongside the layout chips. Assign any available preset to it. The `BrandingService` resolves the active preset for the `"branding"` layout key via `IThemeService.GetConfiguration("branding")` (setting: `theme.layout.branding.presetId`).

**Fallback:** if no preset is explicitly assigned, `ThemeModule.InitializeAsync` seeds the key with `"default"`, so branding falls back to the default preset automatically.

**Effect:** the assigned preset's Light/Dark **Primary** colour is used as `BrandColor`/`BrandColorDark` in `EmailBranding`, and as the `currentColor` replacement when rasterizing all PNG assets (favicons, email logos, PWA icons).

---

## Settings Keys (v2)

| Key | Description |
|---|---|
| `theme.branding.logo.svgMarkup` | BrandingLogo SVG markup |
| `theme.branding.icon.svgMarkup` | BrandingIcon SVG markup |
| `theme.branding.asset.email-logo-light` | Storage FileId for email-logo-light.png |
| `theme.branding.asset.email-logo-dark` | Storage FileId for email-logo-dark.png |
| `theme.branding.asset.favicon-16` | Storage FileId for favicon-16.png |
| `theme.branding.asset.favicon-32` | Storage FileId for favicon-32.png |
| `theme.branding.asset.apple-touch-icon` | Storage FileId for apple-touch-icon.png |
| `theme.branding.asset.pwa-192` | Storage FileId for pwa-192.png |
| `theme.branding.asset.pwa-512` | Storage FileId for pwa-512.png |
| `theme.branding.asset.pwa-maskable` | Storage FileId for pwa-maskable.png |
| `app.publicBaseUrl` | Public base URL (required for absolute email logo URLs) |
| `app.name` | Application name for webmanifest and email templates |

---

## Docker / Linux Requirements

SkiaSharp requires native libraries. `SkiaSharp.NativeAssets.Linux.NoDependencies` bundles `libSkiaSharp.so` for **glibc-based** Linux.

**Supported:**
```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:10.0   # Debian-based
```

**Not supported without manual steps:** Alpine. If Alpine is required:
```dockerfile
RUN apk add --no-cache libstdc++ libgcc
```
and switch to `SkiaSharp.NativeAssets.Linux` (with dependencies).

---

## Admin UI — Branding Page

The Branding page is available at `/admin/theme/branding` (accessible via Admin shell → Theme & Branding → Branding). It replaces the old Logo page; `/admin/theme/logo` redirects to the new route automatically.

### Tabs

**Logo tab**
- Displays a live preview of the current BrandingLogo SVG using `<BwLogo />`.
- Upload button opens a file picker filtered to `.svg` / `image/svg+xml`.
- Maximum upload size: 5 MB.
- Remove button deletes the SVG and all derived logo assets.

**Icon tab**
- Displays a 64×64 px inline SVG preview of the current BrandingIcon.
- Upload button for `.svg` files (max 2 MB).
- Remove button deletes the SVG and all derived icon assets.

**Derived Assets tab**
- Responsive grid of all 8 generated PNG assets with `<img>` previews, dimension labels, palette indicator (Light/Dark), and generated/pending status.
- Each generated asset shows a link to its URL.
- **Regenerate All Assets** button triggers re-rasterization from the currently stored SVG sources using the active palette — useful after a preset change without re-uploading the SVG. The button is disabled while no source SVG (logo or icon) exists, since there is nothing to render.
- When no derived assets have been generated yet (`BrandingAssetSet.HasAnyAsset == false`), the grid is replaced with an informational empty state instead of a row of empty placeholder tiles: it prompts the user to upload a logo/icon SVG, or — if a source SVG exists but rendering produced nothing — to use the Regenerate button.
- Link to `/bw/branding/site.webmanifest` for preview.

### Localization

All UI strings are available in English (neutral `ThemeResources.resx`) and German (`ThemeResources.de.resx`) in `BieberWorks.SDK.Theme.UI/Resources/`. The standard `IStringLocalizer<ThemeResources>` approach is used; strings are injected into both the base class and the Razor page automatically at runtime.

### Permissions

Same policy as other Theme admin pages: `perm:theme:theme:manage`.

### Responsive layout

The page uses `MudGrid` with `xs`/`sm`/`md` breakpoints throughout. On xs screens all sections stack vertically; on sm+ screens upload panel and preview panel sit side-by-side; the derived asset grid uses a multi-column layout (2–6 columns depending on breakpoint).

---

## Migrating from the legacy logo API

### Removed API surface

| Removed | Replacement |
|---|---|
| `IBrandingService.GetLogoAsync()` | `GetLogoSvgAsync()` |
| `IBrandingService.UploadAppLogoAsync()` | `UploadLogoSvgAsync()` |
| `IBrandingService.SetAppLogoMarkupAsync()` | `UploadLogoSvgAsync()` with a stream |
| `IBrandingService.DeleteAppLogoAsync()` | `DeleteLogoSvgAsync()` |
| `IBrandingService.GetEmailLogoUrlAsync()` | `GetEmailBrandingAsync().LogoUrl` |
| `IBrandingService.UploadEmailLogoAsync()` | Upload BrandingLogo SVG instead |
| `IBrandingService.DeleteEmailLogoAsync()` | `DeleteLogoSvgAsync()` |
| `IThemeAdminService.SetLogoStorageKeyAsync()` | Removed (storage-key concept gone) |
| `IThemeAdminService.DeleteLogoAsync()` | `IBrandingService.DeleteLogoSvgAsync()` |
| `ThemeLogoChangedEvent` (obsolete) | `BrandingChangedEvent` |

### Settings migration

The following legacy settings keys are **deleted automatically** during `ThemeModule.InitializeAsync`:

- `theme.logo.storageKey`
- `theme.logo.svgMarkup`
- `theme.logo.source`
- `theme.logo.email.storageKey`

The old SVG markup value is **not migrated** to the new `theme.branding.logo.svgMarkup` key. Re-upload the logo SVG via Admin UI → Branding.

### Orphaned storage blobs

Old email logo PNG blobs in SDK-Storage are **not automatically deleted**. They appear in the Storage Admin list; delete manually if desired.

### Version range

Check the [Releases page](https://github.com/BieberWorks/SDK-Theme/releases) for the current stable version and update your version range references accordingly.
