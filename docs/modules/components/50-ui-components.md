# MudBlazor Components

Package: `BieberWorks.SDK.Components.UI.MudBlazor`

Ready-made MudBlazor Razor components for rendering and editing markdown, rich text, and code.

## BwMarkdownViewer

Display Markdown as rendered HTML.

The component renders without any wrapper element — if you need a `MudPaper` or `MudCard` around it, wrap it yourself.

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `Content` | `string?` | — | Raw Markdown to render |

### Example

```razor
<BwMarkdownViewer Content="@markdown" />

@* With your own card wrapper: *@
<MudCard>
    <MudCardContent>
        <BwMarkdownViewer Content="@markdown" />
    </MudCardContent>
</MudCard>
```

---

## BwMarkdownEditor

Split-pane markdown editor with live preview. Preview is refreshed after a 300 ms debounce on each keystroke. A built-in help dialog shows a markdown cheat sheet.

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `Value` | `string` | `""` | Current Markdown source (two-way bindable via `@bind-Value`) |
| `ValueChanged` | `EventCallback<string>` | — | Fired when the user edits |
| `Label` | `string?` | — | Optional label shown above the editor |
| `Class` | `string?` | — | CSS class applied to the root element |

### Example

```razor
<BwMarkdownEditor 
    @bind-Value="@content"
    Label="Description"
/>

@code {
    private string content = "# Hello";
}
```

---

## BwCodeBlock

Syntax-highlighted code display with a copy-to-clipboard button.

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `Code` | `string` | `""` | Source code to highlight |
| `Language` | `string` | `"text"` | Language identifier (e.g. `csharp`, `json`, `bash`) |
| `ShowCopyButton` | `bool` | `true` | Show the copy-to-clipboard button |

### Example

```razor
<BwCodeBlock 
    Code="@code"
    Language="csharp"
    ShowCopyButton="true"
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

Plain-text editor backed by `IRichTextSerializer`. Phase 1 uses a `MudTextField` multiline input; a WYSIWYG widget is planned for a future phase once MudBlazor provides one.

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `Value` | `string` | `""` | Current content (two-way bindable via `@bind-Value`) |
| `ValueChanged` | `EventCallback<string>` | — | Fired when the user edits |
| `Placeholder` | `string?` | — | Placeholder text shown when the editor is empty |

### Example

```razor
<BwRichTextEditor 
    @bind-Value="@richText"
    Placeholder="Enter content…"
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

`BwMarkdownViewer` and `BwMarkdownEditor` expose CSS hooks via class names. To override component styles globally, add rules to your host stylesheet:

```css
.bw-markdown-viewer {
    /* custom styles */
}

.bw-markdown-preview {
    /* preview pane in the editor */
}

.bw-code-block {
    /* code block wrapper */
}

.bw-code-block__content {
    /* code block inner content area */
}
```

Include the stylesheet in `App.razor` or `_Layout.html`.
