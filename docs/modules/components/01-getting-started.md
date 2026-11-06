# Setup & Configuration

## NuGet installation

### With MudBlazor UI (recommended)

```bash
dotnet add package BieberWorks.SDK.Components.UI.Blazor.MudBlazor
```

This includes `BieberWorks.SDK.Components.UI.Blazor` and the contracts. The implementation package `BieberWorks.SDK.Components` (parser, highlighter) is referenced and registered separately, see `Program.cs` below.

### With custom UI framework

Use the UI Base classes to implement your own framework (FluentUI, MAUI, etc.):

```bash
dotnet add package BieberWorks.SDK.Components.UI.Blazor
```

This pulls in the contracts and `BieberWorks.SDK.Core`, but not the implementation package `BieberWorks.SDK.Components`. In a host, add `BieberWorks.SDK.Components` as well; in a separate WASM frontend you must register an implementation of `IMarkdownParser`, `ICodeHighlighter` and `IRichTextSerializer` yourself, otherwise render on the server and deliver sanitized HTML in the DTO.

### Minimal setup (services only, no UI)

```bash
dotnet add package BieberWorks.SDK.Components
```

::: info Package source
All packages are in GitHub Packages of the `BieberWorks` organization. A `nuget.config` with the `bieberworks` feed and a valid `PACKAGES_TOKEN` is required.
:::

## CSS stylesheet

Add the following link to your `App.razor` (Blazor Server) or `index.html` (WASM) inside `<head>`:

```html
<link rel="stylesheet" href="_content/BieberWorks.SDK.Components.UI.Blazor.MudBlazor/bw-markdown.css" />
```

**Important:** MudBlazor resets all browser default styles. This stylesheet restores the rendering of Markdown elements (headings, lists, code blocks, tables, horizontal rules, blockquotes, etc.). Without this link, these elements will be displayed unstyled.

## Program.cs

### Step 1: Register both modules explicitly

```csharp
// Implementation layer — Markdig, HtmlSanitizer, AngleSharp
builder.Services.AddModule<ComponentsModule>(builder.Configuration);

// MudBlazor UI layer — base classes and Razor components
builder.Services.AddModule<ComponentsUiMudBlazorModule>(builder.Configuration);
```

`ComponentsUiMudBlazorModule` no longer auto-wires `ComponentsModule`. Both must be registered
explicitly so that WASM hosts and other non-server scenarios can omit the implementation
package (and its Markdig/HtmlSanitizer/AngleSharp weight) when they do not need it.

The two registrations provide:
- `IMarkdownParser` (default: `MarkdigParser`)
- `ICodeHighlighter` (default: `ColorCodeHighlighter`)
- `IRichTextSerializer` (default: `PassthroughRichTextSerializer`)

### Step 2: Map Razor assemblies (if using MudBlazor UI)

In `Program.cs`:

```csharp
app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode()
    .AddBwModuleAssemblies(typeof(Program).Assembly);
```

In `Routes.razor`:

```razor
<BwRouter AppAssembly="typeof(App).Assembly">
```

::: warning Both entries are mandatory
`BwRouter` lives in `BieberWorks.SDK.UI.Blazor.MudBlazor.Routing` (add `@using BieberWorks.SDK.UI.Blazor.MudBlazor.Routing` to `_Imports.razor`). Together with `AddBwModuleAssemblies` on the server it discovers all `BieberWorks.SDK.*` UI assemblies automatically, so no per-module assembly list is needed. Missing `AddBwModuleAssemblies` means routable pages won't be found; a plain `<Router>` without `BwRouter` does not route SDK module pages from auto-discovery.
:::

## Configuration

### Markdown parser options (`MarkdownParserOptions`)

```json
{
  "Components": {
    "Markdown": {
      "SanitizeHtml": true,
      "UseAdvancedExtensions": true,
      "UseBootstrapClasses": false
    }
  }
}
```

| Key | Default | Description |
|---|---|---|
| `SanitizeHtml` | `true` | Strip potentially dangerous tags using `Ganss.Xss.HtmlSanitizer` (XSS prevention). Recommended — leave enabled in production. |
| `UseAdvancedExtensions` | `true` | Enable the Markdig "advanced" extension set (tables, task lists, citations, and more). |
| `UseBootstrapClasses` | `false` | Apply Bootstrap-compatible CSS classes to generated HTML. Useful when the host uses Bootstrap rather than MudBlazor. |
