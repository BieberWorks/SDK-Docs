# Setup & Configuration

## Prerequisites

SDK-Theme has no own database — it relies on two other SDK modules:

- **SDK-Settings** — stores all theme and branding settings as key/value pairs
- **SDK-Storage** — stores SVG sources and generated PNG branding assets

Both must be registered before Theme.

## NuGet packages

Add the packages that match your host type:

```xml
<!-- All hosts -->
<PackageReference Include="BieberWorks.SDK.Theme" Version="*" />

<!-- Blazor Server / WASM hosts with built-in UI pages -->
<PackageReference Include="BieberWorks.SDK.Theme.UI.MudBlazor" Version="*" />
```

## Program.cs

```csharp
// 1. (Optional) register host-defined presets BEFORE AddBieberWorksModules
builder.Services.AddThemePreset(new ThemePreset(
    Id: "my-brand",
    DisplayName: "My Brand",
    LightPalette: new ThemePalette(Primary: "#E63946", /* … */),
    DarkPalette:  new ThemePalette(Primary: "#F4A261", /* … */)));

// 2. (Optional) register a host-defined layout so it appears in the Preset admin page
builder.Services.AddThemeableLayout<MyMainLayout>();

// 3. Register all modules (Theme self-wires via IModule)
builder.Services.AddBieberWorksModules();

// 4. Register the Admin + Account UI sections
builder.Services.AddThemeUi();
```

`AddThemeUi()` registers `ThemeAdminSection` with the Admin shell and `ThemeAccountSection` with the Account shell.

## Routes.razor

Place `<BwFaviconLinks />` inside `<HeadContent>` so the generated favicon and PWA link tags are injected:

```razor
<HeadContent>
    <BwFaviconLinks />
</HeadContent>
```

The component renders nothing if no icon SVG has been uploaded yet.

Also add the `Theme.UI.MudBlazor` assembly to `AdditionalAssemblies` so the router discovers the built-in pages:

```razor
<Router AppAssembly="typeof(App).Assembly"
        AdditionalAssemblies="new[] { typeof(BieberWorks.SDK.Theme.UI.MudBlazor.ThemeUiAssemblyMarker).Assembly }">
    …
</Router>
```

## BwThemeProvider

Wrap your application root (typically `Routes.razor` or `MainLayout.razor`) with `<BwThemeProvider>`:

```razor
<BwThemeProvider LayoutKey="main">
    @Body
</BwThemeProvider>
```

`LayoutKey` must match an `IThemeableLayout.LayoutKey` registered in DI. The component reads the active preset from `IThemeService` and applies the palette to the MudBlazor theme.

## Module initialisation

`ThemeModule` implements `IModuleInitializer`. At host startup (`app.InitializeBieberWorksModulesAsync()`) it:

1. Registers all setting definitions with `ISettingsAdminService`.
2. Seeds each registered `IThemeableLayout` with preset key `"default"` if no preset is assigned yet.
3. Deletes legacy v1.x settings keys (idempotent).

No manual migration steps are required.

## Docker / Linux

SkiaSharp requires native libraries. The implementation package depends on `SkiaSharp.NativeAssets.Linux.NoDependencies`, which bundles `libSkiaSharp.so` for **glibc-based** Linux images.

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:10.0   # Debian-based — supported out of the box
```

**Alpine** is not supported without additional steps:

```dockerfile
RUN apk add --no-cache libstdc++ libgcc
```

and switch to `SkiaSharp.NativeAssets.Linux` (with dependencies).
