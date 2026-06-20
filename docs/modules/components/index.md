# SDK-Components

The Components module provides reusable, extensible rendering and editing components for rich text, markdown, and code. It includes interfaces for parsing, highlighting, and serialization, plus ready-made MudBlazor UI.

## What the module offers

- **Markdown parsing** (`IMarkdownParser`) — renders Markdown to sanitized HTML with `Markdig` + `HtmlSanitizer`
- **Syntax highlighting** (`ICodeHighlighter`) — colors code blocks with `ColorCode.Core`
- **Rich text serialization** (`IRichTextSerializer`) — convert between formats
- **Framework-agnostic base classes** — extend for FluentUI, MAUI, or custom UI frameworks
- **Ready-made MudBlazor components** — viewer, editor, code block, rich text editor
- **No database** — pure service layer; integrates seamlessly with other SDK modules

## Package table

| Package | Description | Version |
|---|---|---|
| `BieberWorks.SDK.Components.Contracts` | Interfaces, options, DTOs — referenced by components and hosts | ![v0.1.0](https://img.shields.io/badge/version-0.1.0-blue) |
| `BieberWorks.SDK.Components` | Core implementation: `MarkdigParser`, `ColorCodeHighlighter`, `PassthroughRichTextSerializer`, `ComponentsModule` | ![v0.1.0](https://img.shields.io/badge/version-0.1.0-blue) |
| `BieberWorks.SDK.Components.UI` | Framework-agnostic base classes: `MarkdownViewerBase`, `MarkdownEditorBase`, `CodeBlockBase`, `RichTextEditorBase` | ![v0.1.0](https://img.shields.io/badge/version-0.1.0-blue) |
| `BieberWorks.SDK.Components.UI.MudBlazor` | MudBlazor RCL: `BwMarkdownViewer`, `BwMarkdownEditor`, `BwCodeBlock`, `BwRichTextEditor` | ![v0.1.0](https://img.shields.io/badge/version-0.1.0-blue) |

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
