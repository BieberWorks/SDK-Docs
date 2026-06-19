# BieberWorks.SDK.Export

Modular export package: PDF (PDFsharp), CSV (CsvHelper), Excel (ClosedXML).

## Packages

| Package | Purpose |
|---|---|
| `BieberWorks.SDK.Export.Contracts` | Interfaces, DTOs, Enums — referenceable by other modules |
| `BieberWorks.SDK.Export` | Implementation: ExportService + Formatters |
| `BieberWorks.SDK.Export.UI` | Blazor base classes (no UI framework dependency) |
| `BieberWorks.SDK.Export.UI.MudBlazor` | MudBlazor rendering (PdfViewer, ExportButton) |

## Supported Formats

| Format | Enum | MIME Type | Library |
|---|---|---|---|
| PDF | `ExportFormat.Pdf` | `application/pdf` | PDFsharp 6.x (MIT) |
| CSV | `ExportFormat.Csv` | `text/csv` | CsvHelper 33.x |
| Excel | `ExportFormat.Excel` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | ClosedXML 0.105.x |
| Word | `ExportFormat.Word` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | Register a custom formatter |
| OpenDocument | `ExportFormat.OpenDocument` | `application/vnd.oasis.opendocument.text` | Register a custom formatter |

## Quick Start (Host Registration)

```csharp
// Program.cs
builder.Services.AddExport(opts =>
{
    opts.FileNamePattern = "{type}_{date}";
});
```

Blazor assembly registration (for UI.MudBlazor):

```csharp
app.MapRazorComponents<App>()
   .AddInteractiveServerRenderMode()
   .AddAdditionalAssemblies(
       typeof(BieberWorks.SDK.Export.UI.MudBlazor.Components.PdfViewer).Assembly,
       typeof(BieberWorks.SDK.Export.UI.PdfViewerBase).Assembly);
```

JS bundle in `App.razor`:

```html
<script src="_content/BieberWorks.SDK.Export.UI.MudBlazor/js/bw-export.js"></script>
```

## CSV Export

```csharp
public record OrderRow(
    [property: Name("Order #")] string OrderId,
    [property: Name("Customer")]  string Customer,
    decimal Total);

await using var result = await exportService.ExportAsync(
    orders,
    new ExportRequest(ExportFormat.Csv, FileName: "orders_june"));

// result.Stream is a MemoryStream (Position=0)
```

## PDF — Custom Layout

Register a custom `IPdfDocumentBuilder<T>` to override the default table layout:

```csharp
public class OrderPdfBuilder : IPdfDocumentBuilder<OrderRow>
{
    public Task BuildAsync(IEnumerable<OrderRow> data, ExportRequest request,
                           Stream stream, CancellationToken ct = default)
    {
        // Use PDFsharp directly
        using var doc  = new PdfDocument();
        using var page = doc.AddPage();
        using var gfx  = XGraphics.FromPdfPage(page);
        // ... draw your layout ...
        doc.Save(stream);
        return Task.CompletedTask;
    }
}

// Host:
builder.Services.AddScoped<IPdfDocumentBuilder<OrderRow>, OrderPdfBuilder>();
```

The `DefaultPdfDocumentBuilder<T>` is registered as a fallback via `TryAddScoped`
and will only be used if no custom builder is registered for `T`.

## Blazor Components

```razor
<!-- ExportButton with format selection menu -->
<ExportButton TItem="OrderRow"
              Data="@orders"
              Formats="@([ExportFormat.Csv, ExportFormat.Excel])"
              FileName="orders"
              UserId="@currentUserId" />

<!-- PDF inline viewer -->
<PdfViewer StreamSource="@LoadPdfAsync" Height="800px" />

@code {
    private Task<Stream> LoadPdfAsync(CancellationToken ct) => ...;
}
```

## Audit

Every export raises an `ExportedEvent` which implements `IAuditableEvent`.
As long as `BieberWorks.SDK.Audit` is registered in the host, every export is automatically logged.

## Notes

- `decimal` values are cast to `double` for Excel (ClosedXML limitation). For exact financial precision, register a custom `IExportFormatter<T>`.
- Word and OpenDocument formatters are not included. Register your own `IExportFormatter<T>` implementation.
