# Email Branding Integration

## Overview

SDK-Email automatically injects global branding variables into every email template and layout render pass. When `ThemeModule` (SDK-Theme) is present, values are resolved from `IBrandingService`. Without ThemeModule the variables are omitted; callers can always supply them explicitly.

## Global Branding Variables

These seven variables are injected into every template and layout before Scriban runs. Caller-supplied values always take precedence (the auto-injected value is skipped when the key is already in the variable dictionary).

| Variable        | Type | Source                                                        | Example                         |
|-----------------|------|---------------------------------------------------------------|---------------------------------|
| `LogoUrl`       | URL  | `EmailBranding.LogoUrl` (light-mode logo, absolute URL)       | `https://example.com/logo.png`  |
| `LogoUrlDark`   | URL  | `EmailBranding.LogoUrlDark` (dark-mode logo, absolute URL)    | `https://example.com/logo-dark.png` |
| `BrandColor`    | Text | `EmailBranding.BrandColor` — `LightPalette.Primary` (hex)    | `#1976d2`                       |
| `BrandColorDark`| Text | `EmailBranding.BrandColorDark` — `DarkPalette.Primary` (hex) | `#90caf9`                       |
| `AppName`       | Text | Settings key `app.name`                                       | `My App`                        |
| `AppBaseUrl`    | URL  | Settings key `app.publicBaseUrl`                             | `https://example.com`           |
| `Year`          | Text | `DateTimeOffset.UtcNow.Year` (always set)                     | `2026`                          |

`LogoUrl` and `LogoUrlDark` are populated by `IBrandingService.GetEmailBrandingAsync` (SDK-Theme v2+), which returns absolute URLs to the generated light/dark PNG email logo assets. If no logo has been uploaded, both are null and the variables are omitted from the render context. `BrandColor` and `BrandColorDark` are sourced from the active theme's light and dark palette `Primary` values respectively; both are null when no theme palette is configured.

### Usage in templates

```html
<!-- Light/dark logos for email clients that support prefers-color-scheme -->
<img src="{{ LogoUrl }}" alt="{{ AppName }}" class="logo-light" />
<img src="{{ LogoUrlDark }}" alt="{{ AppName }}" class="logo-dark" />
<p style="color: {{ BrandColor }}">Welcome to {{ AppName }}</p>
<p style="color: {{ BrandColorDark }}">Dark-mode accent</p>
<p>&copy; {{ Year }} {{ AppName }}. <a href="{{ AppBaseUrl }}">Visit us</a></p>
```

## Caching

`CachedEmailTemplateStore` caches the resolved `EmailBranding` snapshot for **5 minutes** (absolute expiry). This is separate from the template/layout cache (30 min).

### Cache invalidation

When any branding asset changes (SVG upload, delete, or asset regeneration via the Theme admin UI), a `BrandingChangedEvent` fires. `BrandingChangedHandler` in the Email module receives this event and invalidates the branding cache. The next render will fetch a fresh snapshot.

Manual invalidation is also possible by calling `CachedEmailTemplateStore.InvalidateBranding()` (internal API, available via DI-resolved `CachedEmailTemplateStore`).

## Optional dependency on ThemeModule

`IBrandingService` is resolved via `IServiceProvider.GetService<IBrandingService>()` (not `GetRequiredService`) in `EmailModule`. If ThemeModule is not registered, the branding service is null, and all five variables are omitted from the render context. Templates that reference them will render an empty string (Scriban `StrictVariables = false`).

## Editor UI — Branding (global) panel

The Template Editor and Layout Editor pages expose a `GlobalVariables` property that returns `GlobalEmailVariables.Branding`. Razor components can render this as a collapsible panel labeled "Branding (global)" (localized: `Editor_Label_BrandingVariables`).

The preview always merges sample values from `GlobalEmailVariables.Branding.ExampleValue` so admins see a visible placeholder logo and brand color in the preview, even when no live branding service is wired up.

### Token validation

The `ComputeValidationWarnings` method in `EmailTemplateEditorPageBase` includes all seven branding variable names in the "known" set. Templates using `{{ LogoUrl }}`, `{{ LogoUrlDark }}`, `{{ BrandColor }}`, `{{ BrandColorDark }}`, etc. will not show an "unknown token" warning.
