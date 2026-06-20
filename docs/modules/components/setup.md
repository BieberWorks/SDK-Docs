# Setup & Configuration

## NuGet installation

### With MudBlazor UI (recommended)

```bash
dotnet add package BieberWorks.SDK.Components.UI.MudBlazor
```

This automatically includes `BieberWorks.SDK.Components` and all underlying layers via dependency chain.

### With custom UI framework

Use the UI Base classes to implement your own framework (FluentUI, MAUI, etc.):

```bash
dotnet add package BieberWorks.SDK.Components.UI
```

This also automatically pulls `BieberWorks.SDK.Components` and the contracts.

### Minimal setup (services only, no UI)

```bash
dotnet add package BieberWorks.SDK.Components
```

::: info Package source
All packages are in GitHub Packages of the `BieberWorks` organization. A `nuget.config` with the `bieberworks` feed and a valid `PACKAGES_TOKEN` is required.
:::

## Program.cs

### Step 1: Add BieberWorks modules (automatic)

```csharp
builder.Services.AddBieberWorksModules(builder.Configuration);
```

This automatically:
1. Registers `ComponentsModule` (via module discovery)
2. Registers all service abstractions:
   - `IMarkdownParser` (default: `MarkdigParser`)
   - `ICodeHighlighter` (default: `ColorCodeHighlighter`)
   - `IRichTextSerializer` (default: `PassthroughRichTextSerializer`)
3. **If MudBlazor UI is referenced:** automatically registers `ComponentsUiModule`, which registers the component factory and event handlers

No additional `AddComponentsUi()` call is needed.

### Step 2: Map Razor assemblies (if using MudBlazor UI)

In `Program.cs`:

```csharp
app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode()
    .AddAdditionalAssemblies(
        typeof(BieberWorks.SDK.Components.UI.MudBlazor.BwMarkdownViewer).Assembly
    );
```

In `Routes.razor`:

```razor
<Router AppAssembly="typeof(App).Assembly"
        AdditionalAssemblies="new[]
        {
            typeof(BieberWorks.SDK.Components.UI.MudBlazor.BwMarkdownViewer).Assembly
        }">
```

::: warning Both entries are mandatory
Missing the assembly entry in `MapRazorComponents` means components won't be found. Missing the router entry can cause Blazor issues on direct navigation.
:::

## Configuration

### Markdown parser options

```json
{
  "Components": {
    "Markdown": {
      "AllowHtml": false,
      "BreakOnSingleLineBreak": false,
      "TableExtension": true,
      "StrikethroughExtension": true
    }
  }
}
```

These options configure the `MarkdigParser`. Defaults are conservative for security.

### Code highlighter language map

```json
{
  "Components": {
    "CodeHighlighter": {
      "LanguageMap": {
        "cs": "csharp",
        "js": "javascript",
        "ts": "typescript",
        "ps": "powershell"
      }
    }
  }
}
```

Maps code fence language hints to `ColorCode.Core` language identifiers.

### MudBlazor component defaults

```json
{
  "Components": {
    "MudBlazor": {
      "MarkdownViewer": {
        "Elevation": 1,
        "ShowRawMarkdown": false
      },
      "MarkdownEditor": {
        "EditorHeight": "400px",
        "PreviewWidth": "50%"
      },
      "CodeBlock": {
        "CopyButtonPosition": "TopRight",
        "Theme": "vs"
      }
    }
  }
}
```

All defaults can be overridden per component instance or globally via configuration.
