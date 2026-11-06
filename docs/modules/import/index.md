# Import

The Import module provides a uniform, format-agnostic bulk-import pipeline for BieberWorks SDK hosts. It accepts an uploaded CSV or Excel file stream and produces a mapped, validated `ImportResult<T>` — imported rows plus collected row errors. Every import is automatically audit-logged when `SDK-Audit` is present in the host.

## What the module offers

- **Two built-in parsers** — CSV (CsvHelper), Excel (ClosedXML), registered as open-generic services
- **Stream-in API** — primary contract is `IImportService.ImportAsync<T>(Stream, ImportRequest<T>, ...)`, with convenience overloads for `byte[]` and `FileInfo` sources
- **Declarative or custom mapping** — decorate properties with `[ImportColumn("Header")]`, or implement `IImportMap<T>` for full control; an ad-hoc per-call override is also supported via `ImportRequest<T>.Map`
- **Async validation pipeline** — DataAnnotations always run first; additional business validators implement `IImportRowValidator<T>.ValidateAsync(...)`, deliberately asynchronous to allow database lookups without a future breaking change
- **Configurable error policy** — `ImportPolicy.CollectAll` (default, partial import), `StopOnFirstError` (all-or-nothing), `StopButKeepValid`
- **Automatic audit trail** — `ImportedEvent` implements `IAuditableEvent`; no extra configuration needed when `SDK-Audit` is active
- **Ready-made Blazor UI** — `ImportUpload` (native `MudFileUpload` upload button) and `ImportErrorGrid` (plain `MudTable` error report), both available as MudBlazor components

## Package overview

| Package | Description | When needed |
|---|---|---|
| `BieberWorks.SDK.Import.Contracts` | Interfaces, DTOs, enums, domain events — no implementation dependency | Always when another module or service references import types |
| `BieberWorks.SDK.Import` | Full implementation: `ImportService`, CSV/Excel parsers, default mapping resolver, async validation pipeline | In the host that performs imports |
| `BieberWorks.SDK.Import.UI.Blazor` | Framework-agnostic Blazor base classes (`ImportUploadBase<T>`, `ImportPreviewBase<T>`) | Transitively — pulled in by `.UI.Blazor.MudBlazor` |
| `BieberWorks.SDK.Import.UI.Blazor.MudBlazor` | Ready-made MudBlazor components (`ImportUpload`, `ImportErrorGrid`) | When using the built-in UI components in the host |
| `BieberWorks.SDK.Import.Jobs` | Optional: offloads large imports to `SDK-Jobs` via `IImportJobDispatcher`, persists run status/errors in its own `import_jobs` schema | When background/async import processing is desired for large files. Not released independently — depends on `SDK-Jobs` and `SDK-Storage` (see [Import Reference](10-import.md#async-jobs-seam)) |

::: tip Versioning
All packages are released together and share one version, computed from Conventional Commits. The latest release and full history live on the [GitHub Releases page](https://github.com/BieberWorks/SDK-Import/releases) (see [changelog](90-changelog.md)).
:::

## When to use which package

| Scenario | Required packages |
|---|---|
| Another module needs `ImportFormatId`, `ImportRequest<T>`, or `IImportService` | `Import.Contracts` |
| Host performs bulk imports (any format) | `Import` |
| Host shows an upload button and error report | `Import` + `Import.UI.Blazor.MudBlazor` |
| Custom mapping for a specific record type | `Import` + implement `IImportMap<T>` (or `[ImportColumn]` attributes) |
| Business validation beyond DataAnnotations | `Import` + implement `IImportRowValidator<T>` |

## Documentation

| Topic | Document |
|---|---|
| Host registration, `AddImport`, `ImportOptions`, mapping, policies, Blazor assembly wiring | [Import Reference](10-import.md) |
| Release history | [Changelog](90-changelog.md) |
