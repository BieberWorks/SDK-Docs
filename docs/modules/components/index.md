# Components

The Components module provides reusable, extensible rendering and editing components for rich text, markdown, and code. It includes interfaces for parsing, highlighting, and serialization, plus ready-made MudBlazor UI.

## What the module offers

- **Markdown parsing** (`IMarkdownParser`) — renders Markdown to sanitized HTML with `Markdig` + `HtmlSanitizer`
- **Syntax highlighting** (`ICodeHighlighter`) — colors code blocks with `ColorCode.Core`
- **Rich text serialization** (`IRichTextSerializer`) — round-trips the editor's internal value to a storable string
- **Framework-agnostic base classes** — extend for FluentUI, MAUI, or custom UI frameworks
- **Ready-made MudBlazor components** — viewer, editor, code block, rich text editor
- **No database** — pure service layer; integrates seamlessly with other SDK modules

## Package table

| Package | Description |
|---|---|
| `BieberWorks.SDK.Components.Contracts` | Interfaces and options — referenced by components and hosts |
| `BieberWorks.SDK.Components` | Core implementation: `MarkdigParser`, `ColorCodeHighlighter`, `PassthroughRichTextSerializer`, `ComponentsModule` |
| `BieberWorks.SDK.Components.UI` | Framework-agnostic base classes: `MarkdownViewerBase`, `MarkdownEditorBase`, `CodeBlockBase`, `RichTextEditorBase` |
| `BieberWorks.SDK.Components.UI.MudBlazor` | MudBlazor RCL: `BwMarkdownViewer`, `BwMarkdownEditor`, `BwCodeBlock`, `BwRichTextEditor` |

For current release versions see the [GitHub Releases page](https://github.com/BieberWorks/SDK-Components/releases).

::: tip Contracts-First
Other modules reference only `BieberWorks.SDK.Components.Contracts`. Implementations are known only to the host.
:::

## Architecture

```
Contracts  (IMarkdownParser, ICodeHighlighter, IRichTextSerializer)
    ↓
Core       (MarkdigParser, ColorCodeHighlighter, PassthroughRichTextSerializer)
    ↓
UI Base    (MarkdownViewerBase, MarkdownEditorBase, CodeBlockBase, RichTextEditorBase)
    ↓
MudBlazor  (BwMarkdownViewer, BwMarkdownEditor, BwCodeBlock, BwRichTextEditor)
```

Each layer is independently referenceable. When referencing `BieberWorks.SDK.Components.UI.MudBlazor`, all lower layers are automatically included and registered via the `IModule` dependency chain.

## Documentation

| Topic | Description |
|---|---|
| [Setup & Configuration](01-getting-started.md) | NuGet installation, Program.cs wiring, `appsettings.json` options |
| [MudBlazor Components](50-ui-components.md) | Component parameters, examples, and styling |
| [Extensibility](10-extensibility.md) | Custom parsers, highlighters, serializers, and UI frameworks |
| [Changelog](90-changelog.md) | Auto-generated — links to GitHub Releases |
