# Changelog

## Unreleased

### Changed
- `ComponentsModule` now auto-registers `ComponentsUiModule` when `BieberWorks.SDK.Components.UI.MudBlazor` is referenced, eliminating the need for manual `AddComponentsUi()` calls
- `ComponentsUI` now depends on `ComponentsModule`, creating an automatic dependency chain; adding only `BieberWorks.SDK.Components.UI.MudBlazor` is sufficient

---

## v0.1.0 (2026-06-19)

### Added
- `BieberWorks.SDK.Components.Contracts`: `IMarkdownParser`, `ICodeHighlighter`, `IRichTextSerializer` interfaces; `MarkdownParserOptions`, `RichTextFormat` enums
- `BieberWorks.SDK.Components`: `MarkdigParser` (Markdig + HtmlSanitizer), `ColorCodeHighlighter` (ColorCode.Core), `PassthroughRichTextSerializer`, `ComponentsModule : IModule`
- `BieberWorks.SDK.Components.UI`: Base classes `MarkdownViewerBase`, `MarkdownEditorBase`, `CodeBlockBase`, `RichTextEditorBase` for custom framework implementations
- `BieberWorks.SDK.Components.UI.MudBlazor`: MudBlazor RCL with `BwMarkdownViewer`, `BwMarkdownEditor`, `BwCodeBlock`, `BwRichTextEditor` components
- Full extensibility model for custom parsers, highlighters, and UI frameworks
- English documentation (index, setup, components, extensibility, changelog)
