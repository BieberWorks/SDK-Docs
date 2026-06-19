# MudBlazor Components

Package: `BieberWorks.SDK.Components.UI.MudBlazor`

Ready-made MudBlazor Razor components for rendering and editing markdown, rich text, and code.

## BwMarkdownViewer

Display Markdown as rendered HTML.

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `Markdown` | `string` | — | Content to render |
| `ShowRawMarkdown` | `bool` | `false` | Show raw markdown toggle |
| `Elevation` | `int` | `1` | MudCard elevation |
| `Class` | `string` | — | CSS class |

### Example

```razor
<BwMarkdownViewer 
    Markdown="@markdown"
    ShowRawMarkdown="true"
    Elevation="2"
/>
```

---

## BwMarkdownEditor

Split-pane markdown editor with live preview.

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `Markdown` | `string` | — | Initial content (two-way bindable) |
| `MarkdownChanged` | `EventCallback<string>` | — | Fired when user edits |
| `EditorHeight` | `string` | `"400px"` | Height of editor pane |
| `PreviewWidth` | `string` | `"50%"` | Width of preview pane |
| `ReadOnly` | `bool` | `false` | Disable editing |
| `Class` | `string` | — | CSS class |

### Example

```razor
<BwMarkdownEditor 
    @bind-Markdown="@content"
    EditorHeight="500px"
    PreviewWidth="40%"
/>

@code {
    private string content = "# Hello";
}
```

---

## BwCodeBlock

Highlighted code display with copy button.

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `Code` | `string` | — | Source code to highlight |
| `Language` | `string` | `"plaintext"` | Code fence language hint (csharp, javascript, etc.) |
| `CopyButtonPosition` | `string` | `"TopRight"` | Copy button placement |
| `Theme` | `string` | `"vs"` | Highlight theme (vs, vs-dark, monokai) |
| `ShowLineNumbers` | `bool` | `false` | Display line numbers |
| `Class` | `string` | — | CSS class |

### Example

```razor
<BwCodeBlock 
    Code="@code"
    Language="csharp"
    Theme="vs-dark"
    ShowLineNumbers="true"
/>

@code {
    private string code = @"public class Example {
    public void Hello() {
        Console.WriteLine(""World"");
    }
}";
}
```

---

## BwRichTextEditor

Unified editor for markdown, HTML, and plain text.

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `Content` | `string` | — | Initial content (two-way bindable) |
| `ContentChanged` | `EventCallback<string>` | — | Fired when user edits |
| `Format` | `RichTextFormat` | `Markdown` | Input format: Markdown, Html, PlainText |
| `EditorHeight` | `string` | `"500px"` | Height of editor |
| `ReadOnly` | `bool` | `false` | Disable editing |
| `ShowToolbar` | `bool` | `true` | Display formatting toolbar |
| `Class` | `string` | — | CSS class |

### Example

```razor
<BwRichTextEditor 
    @bind-Content="@richText"
    Format="RichTextFormat.Markdown"
    EditorHeight="600px"
    ShowToolbar="true"
/>

@code {
    private string richText = "**Bold** and *italic*";
}
```

---

## Permissions

The components module does not define permissions; rendering is unrestricted. Authorization is the host's responsibility.

---

## Styling

All components support the `Class` parameter for custom styling. MudBlazor theming is automatically applied.

To override component styles globally, create a custom CSS in your host:

```css
.bw-markdown-viewer {
    /* custom styles */
}

.bw-markdown-editor {
    /* custom styles */
}

.bw-code-block {
    /* custom styles */
}

.bw-rich-text-editor {
    /* custom styles */
}
```

Include the CSS in `App.razor` or `_Layout.html`.
