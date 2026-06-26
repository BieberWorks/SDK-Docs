# Export

The Export module provides a uniform, format-agnostic data-export pipeline for BieberWorks SDK hosts. It accepts any `IAsyncEnumerable<T>` or `IEnumerable<T>` data source and produces a ready-to-stream `ExportResult` in PDF, CSV, or Excel format. Every export is automatically audit-logged when `SDK-Audit` is present in the host.

## What the module offers

- **Three built-in formatters** — PDF (PDFsharp), CSV (CsvHelper), Excel (ClosedXML), registered as open-generic services
- **Streaming-first API** — primary contract is `IExportService.ExportAsync<T>(IAsyncEnumerable<T>, ...)` with a synchronous `IEnumerable<T>` convenience extension; CSV is truly streamed, PDF/Excel are materialized internally due to library constraints
- **Custom PDF layouts** — register `IPdfDocumentBuilder<T>` in the host to fully control PDF rendering; the `DefaultPdfDocumentBuilder<T>` is the fall-back
- **Custom formatters** — implement `IExportFormatter<T>` and register it to add Word, OpenDocument, or any other format
- **Automatic audit trail** — `ExportedEvent` implements `IAuditableEvent`; no extra configuration needed when `SDK-Audit` is active
- **Ready-made Blazor UI** — `ExportButton` (single-format button or multi-format menu) and `PdfViewer` (inline iframe with Blob-URL lifecycle management), both available as MudBlazor components

## Package overview

| Package | Description | When needed |
|---|---|---|
| `BieberWorks.SDK.Export.Contracts` | Interfaces, DTOs, enums, domain events — no implementation dependency | Always when another module or service references export types |
| `BieberWorks.SDK.Export` | Full implementation: `ExportService`, PDF/CSV/Excel formatters, `DefaultPdfDocumentBuilder` | In the host that performs exports |
| `BieberWorks.SDK.Export.UI` | Framework-agnostic Blazor base classes (`ExportButtonBase<T>`, `PdfViewerBase`) | Transitively — pulled in by `.UI.MudBlazor` |
| `BieberWorks.SDK.Export.UI.MudBlazor` | Ready-made MudBlazor components (`ExportButton`, `PdfViewer`) and JS bundle | When using the built-in UI components in the host |

::: tip Versioning
All packages are released together and share one version, computed from Conventional Commits. The latest release and full history live on the [GitHub Releases page](https://github.com/BieberWorks/SDK-Export/releases) (see [changelog](CHANGES.md)).
:::

## When to use which package

| Scenario | Required packages |
|---|---|
| Another module needs `ExportFormat`, `ExportRequest`, or `IExportService` | `Export.Contracts` |
| Host performs exports (any format) | `Export` |
| Host shows download buttons or an inline PDF viewer | `Export` + `Export.UI.MudBlazor` |
| Custom PDF layout for a specific record type | `Export` + implement `IPdfDocumentBuilder<T>` |
| Custom format (Word, OpenDocument, etc.) | `Export` + implement `IExportFormatter<T>` |

## Documentation

| Topic | Document |
|---|---|
| Host registration, `AddExport`, `ExportOptions`, Blazor assembly wiring, JS bundle | [Export Reference](export.md) |
| Release history | [Changelog](CHANGES.md) |
