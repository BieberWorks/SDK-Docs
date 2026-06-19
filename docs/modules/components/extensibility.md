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

    public Task<string> ParseAsync(string markdown, MarkdownParserOptions? options = null)
    {
        // Your custom parsing logic
        return Task.FromResult(html);
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
    public Task<string> HighlightAsync(string code, string language)
    {
        // Your custom highlighting logic
        return Task.FromResult(highlighted);
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
    public Task<string> SerializeAsync(string content, RichTextFormat from, RichTextFormat to)
    {
        // Your custom serialization logic
        return Task.FromResult(result);
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

- `MarkdownViewerBase` — display-only markdown rendering
- `MarkdownEditorBase` — editable markdown with split pane preview
- `CodeBlockBase` — highlighted code display
- `RichTextEditorBase` — unified rich text editor

### Example: FluentUI implementation

Add a reference to `BieberWorks.SDK.Components.UI` and create a FluentUI component:

```csharp
// FluentUI/BwMarkdownViewer.razor.cs
using BieberWorks.SDK.Components.UI;

public partial class BwMarkdownViewer : MarkdownViewerBase
{
    // Inject services and override rendering logic
    // Use FluentUI components in BwMarkdownViewer.razor
}
```

In `BwMarkdownViewer.razor`:

```razor
@inherits BwMarkdownViewer
@namespace BieberWorks.SDK.Components.UI.FluentUI

<FluentCard>
    @((MarkupString)RenderedHtml)
    @if (ShowRawMarkdown)
    {
        <FluentButton>Toggle Raw</FluentButton>
    }
</FluentCard>
```

Register in `Program.cs`:

```csharp
builder.Services.AddScoped<IMarkdownParser>(sp => sp.GetRequiredService<ComponentsModule>().Parser);
// ... other services
// Users will now use your FluentUI components
```

---

## Logging

All built-in implementations use structured logging via `ILogger<T>` and `[LoggerMessage]` delegates. Custom implementations should follow the same pattern for consistency.

---

## Testing

Custom implementations are easily testable because they depend only on the Contracts interfaces:

```csharp
[Fact]
public async Task CustomParser_ParsesValidMarkdown()
{
    // Arrange
    var parser = new CustomMarkdownParser(new MockLogger<CustomMarkdownParser>());
    var markdown = "# Heading";

    // Act
    var html = await parser.ParseAsync(markdown);

    // Assert
    html.Should().Contain("<h1>");
}
```

No database, no HTTP calls—pure unit testing.
