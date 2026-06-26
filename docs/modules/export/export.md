# Export Reference

Detailed API and configuration reference for `BieberWorks.SDK.Export`. For a high-level overview see [index.md](index.md).

## Packages

| Package | Purpose |
|---|---|
| `BieberWorks.SDK.Export.Contracts` | Interfaces, DTOs, enums, domain events — referenceable by other modules |
| `BieberWorks.SDK.Export` | Implementation: `ExportService` + built-in formatters + `DefaultPdfDocumentBuilder` |
| `BieberWorks.SDK.Export.UI` | Blazor base classes (no UI framework dependency) |
| `BieberWorks.SDK.Export.UI.MudBlazor` | MudBlazor components (`PdfViewer`, `ExportButton`) and JS bundle |

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
    // FileNamePattern placeholders: {type} = T type name, {date} = ISO date, {format} = format name
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

## Streaming

The primary `IExportService.ExportAsync<T>` overload accepts `IAsyncEnumerable<T>`, making it
suitable for database cursors, paginated APIs, or any lazily-evaluated data source.

```csharp
// Primary API — IAsyncEnumerable<T>
IAsyncEnumerable<OrderRow> stream = dbContext.Orders
    .Select(o => new OrderRow(o.Id, o.Customer, o.Total))
    .AsAsyncEnumerable();

await using var result = await exportService.ExportAsync(
    stream,
    new ExportRequest(ExportFormat.Csv, FileName: "orders_june"));

// result.Stream is readable (Position=0)
// result.RecordCount contains the number of rows written (for CSV and Excel)
```

A convenience overload via `ExportServiceExtensions` wraps synchronous `IEnumerable<T>` transparently:

```csharp
// Synchronous IEnumerable<T> — no code change required in existing callers
IEnumerable<OrderRow> orders = GetOrders();

await using var result = await exportService.ExportAsync(
    orders,
    new ExportRequest(ExportFormat.Csv, FileName: "orders_june"));
```

### Library Limitations

| Format | Streaming behaviour |
|---|---|
| CSV | True streaming via `CsvHelper.WriteRecordsAsync(IAsyncEnumerable<T>)`. No intermediate buffer per record. |
| Excel | ClosedXML requires all rows in memory before calling `workbook.SaveAs`. Internally materialized via `await foreach` + `List<T>`. |
| PDF | PDFsharp requires all data for pagination. Internally materialized via `await foreach` + `List<T>`. |

The `IAsyncEnumerable<T>` interface is future-proof: when the Excel/PDF libraries add streaming
support, the public contract does not need to change.

## ExportRequest

All export operations are configured via `ExportRequest`:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `Format` | `ExportFormat` | — | Target format (required) |
| `FileName` | `string?` | `null` | File name without extension. When `null`, `ExportOptions.FileNamePattern` is used. |
| `SheetName` | `string` | `"Export"` | Tab/sheet name for multi-sheet formats (Excel). |
| `UserId` | `string?` | `null` | User ID attached to the `ExportedEvent` for audit logging. |
| `Metadata` | `IReadOnlyDictionary<string, string>?` | `null` | Arbitrary key-value pairs forwarded to `IPdfDocumentBuilder<T>` implementations (e.g. report title, company name). |

## ExportResult

```csharp
public record ExportResult(
    Stream Stream,        // Readable, Position=0
    string ContentType,
    string FileName,
    int?   RecordCount = null);  // null for PDF (custom builders do not report count)
```

`ExportResult` implements `IAsyncDisposable`; always dispose it with `await using`.

`RecordCount` is populated by CSV and Excel formatters. It equals `0` when no records were exported.
For PDF it is `null` because `IPdfDocumentBuilder<T>` implementations consume the stream
internally without reporting a count to the formatter.

## CSV Export

```csharp
public record OrderRow(
    [property: Name("Order #")] string OrderId,
    [property: Name("Customer")]  string Customer,
    decimal Total);

await using var result = await exportService.ExportAsync(
    orders,   // IEnumerable<T> or IAsyncEnumerable<T>
    new ExportRequest(ExportFormat.Csv, FileName: "orders_june"));

// result.Stream is readable (Position=0)
// result.RecordCount == number of rows written
```

## PDF — Custom Layout

Register a custom `IPdfDocumentBuilder<T>` to override the default table layout.
The interface accepts `IAsyncEnumerable<T>` — materialize internally if the PDF library requires it:

```csharp
public class OrderPdfBuilder : IPdfDocumentBuilder<OrderRow>
{
    public async Task BuildAsync(IAsyncEnumerable<OrderRow> data, ExportRequest request,
                                 Stream stream, CancellationToken ct = default)
    {
        // Materialize because PDFsharp needs all rows for pagination
        var rows = new List<OrderRow>();
        await foreach (var row in data.WithCancellation(ct))
            rows.Add(row);

        using var doc  = new PdfDocument();
        var page = doc.AddPage();
        using var gfx  = XGraphics.FromPdfPage(page);
        // ... draw your layout using rows ...
        doc.Save(stream);
    }
}

// Host:
builder.Services.AddScoped<IPdfDocumentBuilder<OrderRow>, OrderPdfBuilder>();
```

The `DefaultPdfDocumentBuilder<T>` is registered as a fallback via `TryAddScoped`
and will only be used if no custom builder is registered for `T`.

## Blazor Components

### ExportButton

Renders a single download button (one format) or a drop-down menu (multiple formats). Triggers a browser download via the JS bundle.

```razor
<ExportButton TItem="OrderRow"
              Data="@orders"
              Formats="@([ExportFormat.Csv, ExportFormat.Excel])"
              FileName="orders"
              UserId="@currentUserId"
              OnExported="@OnExportDone"
              OnError="@OnExportError" />
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `Data` | `IEnumerable<T>` | — | Records to export (required). |
| `Formats` | `IReadOnlyList<ExportFormat>` | CSV, Excel, PDF | Formats shown in the menu. Single entry renders a plain button. |
| `FileName` | `string?` | `null` | File name without extension (falls back to `ExportOptions.FileNamePattern`). |
| `UserId` | `string?` | `null` | User ID for audit. |
| `OnExported` | `EventCallback<ExportResult>` | — | Raised after a successful export. |
| `OnError` | `EventCallback<Exception>` | — | Raised on failure. If no delegate is set, the exception is re-thrown. |

### PdfViewer

Renders an inline PDF viewer using a browser `<iframe>` backed by a Blob URL. Manages Blob URL lifecycle (create on load, revoke on update/dispose).

```razor
<!-- From an async stream factory -->
<PdfViewer StreamSource="@LoadPdfAsync" Height="800px" />

<!-- Or directly from a byte array -->
<PdfViewer PdfBytes="@pdfBytes" Height="600px" />

@code {
    private Task<Stream> LoadPdfAsync(CancellationToken ct) => ...;
}
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `StreamSource` | `Func<CancellationToken, Task<Stream>>?` | `null` | Async factory for the PDF stream. |
| `PdfBytes` | `byte[]?` | `null` | PDF bytes. Alternative to `StreamSource`; takes precedence when both are set. |
| `Height` | `string` | `"600px"` | CSS height of the viewer container. |

## Audit

Every export raises an `ExportedEvent` which implements `IAuditableEvent`.
As long as `BieberWorks.SDK.Audit` is registered in the host, every export is automatically logged.
The event includes `RecordCount` (0 for PDF when count is unavailable).

## Notes

- `decimal` values are cast to `double` for Excel (ClosedXML limitation). For exact financial precision, register a custom `IExportFormatter<T>`.
- Word and OpenDocument formatters are not included. Register your own `IExportFormatter<T>` implementation.
