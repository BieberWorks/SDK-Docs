# Extensibility

SDK-Components is designed for extension. Implement custom parsers, highlighters, serializers, or UI frameworks.

## Custom parsers

To implement a custom markdown parser, implement `IMarkdownParser`:

```csharp
using BieberWorks.SDK.Components.Contracts;

public class CustomMarkdownParser : IMarkdownParser
{
    private readonly ILogger<CustomMarkdownParser> _logger;

    public CustomMarkdownParser(ILogger<CustomMarkdownParser> logger)
    {
        _logger = logger;
    }

    public string Parse(string? markdown)
    {
        if (string.IsNullOrWhiteSpace(markdown))
            return string.Empty;

        // Your custom parsing logic — return an HTML string.
        return html;
    }
}
```

Register it in `Program.cs` after `AddBieberWorksModules`:

```csharp
builder.Services.AddScoped<IMarkdownParser, CustomMarkdownParser>();
```

The custom implementation replaces the default `MarkdigParser`.

---

## Custom highlighters

Implement `ICodeHighlighter`:

```csharp
using BieberWorks.SDK.Components.Contracts;

public class CustomCodeHighlighter : ICodeHighlighter
{
    public IReadOnlyList<string> SupportedLanguages => new[] { "csharp", "json" };

    public string Highlight(string code, string languageId)
    {
        // Your custom highlighting logic — return an HTML string.
        return highlighted;
    }
}
```

Register:

```csharp
builder.Services.AddScoped<ICodeHighlighter, CustomCodeHighlighter>();
```

---

## Custom serializers

Implement `IRichTextSerializer`:

```csharp
using BieberWorks.SDK.Components.Contracts;

public class CustomRichTextSerializer : IRichTextSerializer
{
    public string Serialize(string? editorValue)
    {
        // Convert the editor's internal value to a storable string.
        return editorValue ?? string.Empty;
    }

    public string Deserialize(string? stored)
    {
        // Convert a stored string back to the editor's internal format.
        return stored ?? string.Empty;
    }
}
```

Register:

```csharp
builder.Services.AddScoped<IRichTextSerializer, CustomRichTextSerializer>();
```

---

## Custom UI frameworks

The UI Base classes allow you to build components for any framework.

### Base classes

- `MarkdownViewerBase` — display-only markdown rendering; exposes `RenderedHtml`
- `MarkdownEditorBase` — editable markdown with debounced live preview; exposes `PreviewHtml`, `Value`, `ValueChanged`, `Label`, `Class`
- `CodeBlockBase` — syntax-highlighted code display with copy button; exposes `HighlightedHtml`, `Code`, `Language`, `ShowCopyButton`, `Copied`
- `RichTextEditorBase` — rich text editor delegating serialization; exposes `EditorValue`, `Value`, `ValueChanged`, `Placeholder`

### Example: FluentUI implementation

Add a reference to `BieberWorks.SDK.Components.UI` and create a FluentUI component:

```csharp
// FluentUI/FluentMarkdownViewer.razor.cs
using BieberWorks.SDK.Components.UI.Components;

public partial class FluentMarkdownViewer : MarkdownViewerBase
{
    // Inject services and override rendering logic if needed.
    // Use FluentUI components in FluentMarkdownViewer.razor.
}
```

In `FluentMarkdownViewer.razor`:

```razor
@inherits MarkdownViewerBase
@namespace BieberWorks.SDK.Components.UI.FluentUI

<FluentCard>
    @((MarkupString)RenderedHtml)
</FluentCard>
```

---

## Logging

All built-in implementations use structured logging via `ILogger<T>` and `[LoggerMessage]` source-generator delegates. Custom implementations should follow the same pattern for consistency.

---

## Testing

Custom implementations are easily testable because they depend only on the Contracts interfaces:

```csharp
[Fact]
public void CustomParser_ParsesValidMarkdown()
{
    // Arrange
    var parser = new CustomMarkdownParser(new MockLogger<CustomMarkdownParser>());
    var markdown = "# Heading";

    // Act
    var html = parser.Parse(markdown);

    // Assert
    html.ShouldContain("<h1>");
}
```

No database, no HTTP calls — pure unit testing.
