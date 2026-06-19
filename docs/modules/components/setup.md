# Setup & Configuration

## NuGet installation

### Minimal setup (services only)

```bash
dotnet add package BieberWorks.SDK.Components.Contracts
dotnet add package BieberWorks.SDK.Components
```

### With MudBlazor UI

```bash
dotnet add package BieberWorks.SDK.Components.UI.MudBlazor
```

### With custom UI framework

Use the UI Base classes to implement your own framework (FluentUI, MAUI, etc.):

```bash
dotnet add package BieberWorks.SDK.Components.UI
```

::: info Package source
All packages are in GitHub Packages of the `BieberWorks` organization. A `nuget.config` with the `bieberworks` feed and a valid `PACKAGES_TOKEN` is required.
:::

## Program.cs

### Step 1: Register the module

`ComponentsModule` implements `IModule`. Registration via `AddBieberWorksModules`:

```csharp
builder.Services.AddBieberWorksModules(builder.Configuration);
```

`ComponentsModule.RegisterServices` is called automatically and registers:

- `IMarkdownParser` (default: `MarkdigParser`)
- `ICodeHighlighter` (default: `ColorCodeHighlighter`)
- `IRichTextSerializer` (default: `PassthroughRichTextSerializer`)

### Step 2: Register UI (optional)

```csharp
builder.Services.AddComponentsUi();
```

This registers the MudBlazor component factory and event handlers.

### Step 3: Map Razor assemblies (if using MudBlazor UI)

```csharp
app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode()
    .AddAdditionalAssemblies(
        typeof(BieberWorks.SDK.Components.UI.MudBlazor.BwMarkdownViewer).Assembly
    );
```

And in `Routes.razor`:

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
