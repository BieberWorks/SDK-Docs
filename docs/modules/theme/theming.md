# Theming

## Concepts

| Concept | Description |
|---|---|
| **Preset** | An immutable pair of `ThemePalette` records (light + dark). Identified by a string `Id`. |
| **Built-in preset** | Code-defined; registered as singletons by `ThemeModule`. Cannot be edited or deleted. |
| **Custom preset** | Created at runtime via Admin UI or `IThemeAdminService`; stored in SDK-Settings as JSON. |
| **Themeable layout** | Any `IThemeableLayout` registered in DI. Associates a `LayoutKey` with the preset assignment column in the Admin UI. |
| **Layout assignment** | Maps a layout key to a preset id; stored under `theme.layout.<layoutKey>.presetId`. Falls back to `"default"` if unset. |
| **User preference** | Per-user preset override; stored under `theme.user.<userId>.presetId`. Only active when feature flag `theme.userPreferences.enabled` is `true`. |

## Built-in presets

| Id | Display name | Notes |
|---|---|---|
| `default` | Default | Blue / dark-navy palette |
| `high-contrast` | High Contrast | Black/white/yellow for accessibility |
| `corporate-blue` | Corporate Blue | Deep navy corporate look |

## `IThemeService`

Read-only; available to any module that references `Theme.Contracts`.

```csharp
// Get the active configuration for a layout (both palettes)
ThemeConfiguration config = themeService.GetConfiguration("main");

// Optionally pass userId to honour per-user preferences
ThemeConfiguration config = themeService.GetConfiguration("main", userId: currentUserId);

// List all available presets (built-in + custom)
IReadOnlyList<ThemePreset>       builtIn = themeService.GetPresets();
IReadOnlyList<CustomThemePreset> custom  = themeService.GetCustomPresets();

// Read the assigned preset id for a layout (null = system default)
string? presetId = themeService.GetLayoutPresetId("admin");
```

`GetConfiguration` reads from the cached `ISettingsService` — no database hit on the hot path.

## `IThemeAdminService`

Write-side; used by the Admin UI and available for programmatic configuration.

### Custom preset CRUD

```csharp
// Create or update
CustomThemePreset saved = await themeAdminService.SaveCustomPresetAsync(preset, modifiedBy: userId);

// Delete (throws InvalidOperationException if still assigned to a layout)
await themeAdminService.DeleteCustomPresetAsync(presetId, modifiedBy: userId);
```

### Layout assignment

```csharp
// Assign preset "corporate-blue" to the main layout
await themeAdminService.AssignPresetToLayoutAsync("main", "corporate-blue", modifiedBy: userId);

// Reset to system default
await themeAdminService.AssignPresetToLayoutAsync("main", presetId: null, modifiedBy: userId);

// Read all assignments
IReadOnlyDictionary<string, string?> assignments =
    await themeAdminService.GetAllLayoutAssignmentsAsync();
```

### User preferences

```csharp
// Store user's choice
await themeAdminService.SetUserPresetAsync(userId, "high-contrast", modifiedBy: userId);

// Reset to layout default
await themeAdminService.SetUserPresetAsync(userId, presetId: null, modifiedBy: userId);
```

Throws `InvalidOperationException` if the `theme.userPreferences.enabled` feature flag is `false`.

### Import / Export

```csharp
// Export a single custom preset as a JSON envelope (SchemaVersion 1)
ThemePresetExport envelope = await themeAdminService.ExportPresetAsync(presetId);

// Import — ID collision handling
ThemePresetImportResult result = await themeAdminService.ImportPresetsAsync(
    envelope,
    mode: PresetImportMode.Rename,   // or Skip / Overwrite
    modifiedBy: userId);
```

## `IThemeableLayout` — registering layouts

Implement and register to make a layout manageable from the Admin Presets page:

```csharp
public sealed class MyMainLayout : IThemeableLayout
{
    public string  LayoutKey   => "main";
    public string  DisplayName => "Main Layout";
    public string? SvgMockup   => null;   // optional 120×80 inline SVG preview
}

// In Program.cs
builder.Services.AddThemeableLayout<MyMainLayout>();
// or with an existing IThemeableLayout implementation in another assembly:
builder.Services.AddThemeableLayout(new MyMainLayout());
```

The built-in **Branding** layout target (`LayoutKey = "branding"`) is registered automatically by `ThemeModule` — it controls the palette used when rasterising SVG branding assets.

## Registering additional built-in presets

```csharp
builder.Services.AddThemePreset(new ThemePreset(
    Id:           "my-brand",
    DisplayName:  "My Brand",
    LightPalette: new ThemePalette
    {
        Primary = "#E63946", Secondary = "#457B9D", Tertiary = "#1D3557",
        Error = "#D62828", Success = "#2D6A4F", Warning = "#E9C46A", Info = "#264653",
        Background = "#F1FAEE", Surface = "#FFFFFF",
        AppbarBackground = "#E63946", DrawerBackground = "#FFFFFF",
        TextPrimary = "#1D3557", TextSecondary = "#457B9D",
    },
    DarkPalette: new ThemePalette { /* … */ }));
```

Host-registered presets appear alongside the built-in presets in the Admin UI and are selectable for any layout assignment.

## Feature flags

| Setting key | Type | Default | Effect |
|---|---|---|---|
| `theme.userPreferences.enabled` | Boolean | `false` | Enables per-user preset override via Account UI |

## Permissions

| Permission | Constant | Effect |
|---|---|---|
| `theme:theme:read` | `ThemePermissions.ThemeRead` | View theme configuration (currently unused in UI gates; for API use) |
| `theme:theme:manage` | `ThemePermissions.ThemeManage` | Access all Admin theme pages and mutate presets / assignments |

## Admin UI

The Admin section is registered at `/admin/theme` by `ThemeAdminSection`. Sub-pages:

| Route | Description |
|---|---|
| `/admin/theme` | Overview landing page |
| `/admin/theme/presets` | Manage custom presets; assign presets to registered layouts via chip selectors |
| `/admin/theme/branding` | Upload BrandingLogo / BrandingIcon SVGs; view derived assets; see [Branding](branding.md) |

## Account UI

The Account section is registered at `/account/theme` by `ThemeAccountSection`. It shows the per-user preset picker (only visible when `theme.userPreferences.enabled` is `true`).

## Domain events

| Event | Fires when |
|---|---|
| `ThemePresetAppliedEvent` | A preset is assigned to a layout |
| `ThemePaletteChangedEvent` | Palette values of a custom preset change |
| `ThemeCustomPresetCreatedEvent` | A custom preset is created |
| `ThemeCustomPresetUpdatedEvent` | A custom preset is updated |
| `ThemeCustomPresetDeletedEvent` | A custom preset is deleted |
| `ThemeLayoutAssignedEvent` | A layout-to-preset assignment changes |
| `ThemeUserPresetChangedEvent` | A user's preset preference changes |

`ThemePresetAppliedEvent` and `ThemePaletteChangedEvent` both trigger automatic branding asset regeneration via internal event handlers.
