# Changelog

## Unreleased

### fix: remove MudPaper wrapper from BwMarkdownViewer

`BwMarkdownViewer` previously always wrapped its output in a `MudPaper` element, which applied an unwanted background colour and padding. The component now renders a plain `<div class="bw-markdown-viewer">` without any visual container. Wrap with `MudPaper`/`MudCard` yourself if needed.

**Breaking:** `Elevation` and `ShowRawMarkdown` parameters (which were not wired up) are removed from documentation.

---

## v0.1.3

### fix: decouple Components.UI from the implementation to eliminate transitive HtmlSanitizer/AngleSharp dependency

`Components.UI.csproj` previously held a direct `ProjectReference` to `Components.csproj`
(the implementation), which caused `HtmlSanitizer 9.x` (and its `AngleSharp 0.17.1`
requirement) to flow transitively to every consumer of `BieberWorks.SDK.Components.UI`.
Consumer test projects using bUnit 2.7+ (AngleSharp 1.4.0) received `NU1608` warnings.

**Changes:**
- `Components.UI.csproj`: removed `ProjectReference` to `Components.csproj`; now references only `Components.Contracts`.
- `ComponentsUiModule`: removed the `AddModule<ComponentsModule>()` call (and the associated `using`). The `.UI` layer is now a pure base-class / contract consumer.
- `Components.UI.MudBlazor.csproj`: added direct `ProjectReference` to `Components.csproj`.
- `ComponentsUiMudBlazorModule`: now calls both `AddModule<ComponentsModule>()` and `AddModule<ComponentsUiModule>()` to preserve the full wiring chain.

Sanitizing functionality (`HtmlSanitizer` in `MarkdigParser`) is fully preserved.
Consumers of `BieberWorks.SDK.Components.UI` no longer see `NU1608`; bUnit test projects
do not need `<NoWarn>` entries.

---

## v0.1.0 (2026-06-19)

### Added
- `BieberWorks.SDK.Components.Contracts`: `IMarkdownParser`, `ICodeHighlighter`, `IRichTextSerializer` interfaces; `MarkdownParserOptions`, `RichTextFormat` enums
- `BieberWorks.SDK.Components`: `MarkdigParser` (Markdig + HtmlSanitizer), `ColorCodeHighlighter` (ColorCode.Core), `PassthroughRichTextSerializer`, `ComponentsModule : IModule`
- `BieberWorks.SDK.Components.UI`: Base classes `MarkdownViewerBase`, `MarkdownEditorBase`, `CodeBlockBase`, `RichTextEditorBase` for custom framework implementations
- `BieberWorks.SDK.Components.UI.MudBlazor`: MudBlazor RCL with `BwMarkdownViewer`, `BwMarkdownEditor`, `BwCodeBlock`, `BwRichTextEditor` components
- Full extensibility model for custom parsers, highlighters, and UI frameworks
- English documentation (index, setup, components, extensibility, changelog)
