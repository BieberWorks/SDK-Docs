# Import Reference

Detailed API and configuration reference for `BieberWorks.SDK.Import`. For a high-level overview see [index.md](index.md).

## Packages

| Package | Purpose |
|---|---|
| `BieberWorks.SDK.Import.Contracts` | Interfaces, DTOs, enums, domain events — referenceable by other modules |
| `BieberWorks.SDK.Import` | Implementation: `ImportService` + built-in CSV/Excel parsers + default mapping resolver |
| `BieberWorks.SDK.Import.UI.Blazor` | Blazor base classes (no UI framework dependency) |
| `BieberWorks.SDK.Import.UI.Blazor.MudBlazor` | MudBlazor components (`ImportUpload`, `ImportErrorGrid`) |

## Supported Formats

| Format | Constant | Library |
|---|---|---|
| CSV | `ImportFormatId.Csv` | CsvHelper 33.x |
| Excel | `ImportFormatId.Excel` | ClosedXML 0.105.x |

Structured import from PDF/Word is intentionally not supported — there is no reliable tabular
model to parse. Register a custom `IImportParser<T>` for additional formats (e.g. JSON, XML).

## Quick Start (Host Registration)

```csharp
// Program.cs
builder.Services.AddImport(opts =>
{
    opts.MaxCollectedErrors = 1000;
    opts.MaxRows = 100_000;
    opts.DefaultPolicy = ImportPolicy.CollectAll;
});
```

Blazor assembly registration (for UI.Blazor.MudBlazor):

```csharp
app.MapRazorComponents<App>()
   .AddInteractiveServerRenderMode()
   .AddBwModuleAssemblies(typeof(Program).Assembly);
```

## ImportRequest&lt;T&gt;

All import operations are configured via `ImportRequest<T>` (generic, so the optional
`Map` override can be typed):

| Parameter | Type | Default | Description |
|---|---|---|---|
| `Format` | `ImportFormatId` | — | Source format (required) |
| `SheetName` | `string?` | `null` | Sheet/tab name for Excel; `null` = first sheet |
| `HasHeaderRow` | `bool` | `true` | Whether the first row contains headers |
| `Map` | `IImportMap<T>?` | `null` | Ad-hoc mapping override for this call; falls back to the DI-registered `IImportMap<T>` (default: attribute/reflection-based) |
| `Policy` | `ImportPolicy` | `CollectAll` | Row-error handling policy |
| `UserId` | `string?` | `null` | User ID attached to the `ImportedEvent` for audit logging |
| `Metadata` | `IReadOnlyDictionary<string, string>?` | `null` | Arbitrary key-value pairs |

## ImportResult&lt;T&gt;

```csharp
public sealed record ImportResult<T>(
    IReadOnlyList<T> Imported,
    IReadOnlyList<ImportRowError> Errors,
    int TotalRows,
    ImportRunStatus Status = ImportRunStatus.Completed,
    Guid? ImportRunId = null);
```

`ImportedCount`, `ErrorCount` and `HasErrors` are computed properties. No stream or
`IAsyncDisposable` semantics — the service fully consumes the source stream and
returns materialized data.

`Status`/`ImportRunId` are additive (default `Completed`/`null`) — only meaningful when
`BieberWorks.SDK.Import.Jobs` is registered and the import was offloaded to a
background job (see [Async / Jobs Seam](#async-jobs-seam)). For a synchronous/inline
import, `Status` is always `Completed` and the result already contains the final data.

## Row Numbering

`ImportRow<T>.RowNumber` and `ImportRowError.RowNumber` are **1-based data rows**
(the header row, if present, is excluded from counting). "Row 3" in an error means
the third data row, which may be physical file/sheet row 4 when a header is present.
Communicate this consistently in any UI that surfaces row numbers to end users.

## Mapping

### Attribute-based (default)

```csharp
public class OrderImportRow
{
    [ImportColumn("Order #", Required = true)]
    public string OrderId { get; set; } = string.Empty;

    [ImportColumn("Customer")]
    public string Customer { get; set; } = string.Empty;

    public decimal Total { get; set; } // no attribute — header "Total" (property name) is used
}
```

### Custom `IImportMap<T>`

```csharp
public class LegacyOrderMap : IImportMap<OrderImportRow>
{
    public IReadOnlyList<ImportColumnMap> Columns { get; } =
    [
        new ImportColumnMap("Bestellnummer", nameof(OrderImportRow.OrderId), Required: true),
        new ImportColumnMap("Kunde", nameof(OrderImportRow.Customer)),
    ];
}

// Register globally for the type:
builder.Services.AddScoped<IImportMap<OrderImportRow>, LegacyOrderMap>();

// Or override ad-hoc per call:
var request = new ImportRequest<OrderImportRow>(ImportFormatId.Csv, Map: new LegacyOrderMap());
```

## Error Policies

| Policy | Behaviour |
|---|---|
| `CollectAll` (default) | Collect all row errors, import all valid rows, return a partial result |
| `StopOnFirstError` | Stop at the first row error; discard all rows parsed so far (all-or-nothing) |
| `StopButKeepValid` | Stop parsing further rows after the first error but keep already-imported valid rows |

`ImportOptions.MaxCollectedErrors` and `ImportOptions.MaxRows` are silent caps (no
exception) — a partial `ImportResult<T>` can therefore look "smaller" than the actual
source file. Surface this in the host UI (e.g. "file has more than 100,000 rows, only
the first X were processed").

## Validation

DataAnnotations validation (`[Required]`, `[Range]`, etc.) always runs first and is
not configurable. Additional business rules — including database lookups — are
implemented via `IImportRowValidator<T>`:

```csharp
public class UniqueOrderIdValidator(AppDbContext db) : IImportRowValidator<OrderImportRow>
{
    public async ValueTask<IReadOnlyList<ImportError>> ValidateAsync(
        OrderImportRow value, int rowNumber, CancellationToken ct = default)
    {
        var exists = await db.Orders.AnyAsync(o => o.OrderId == value.OrderId, ct);
        return exists
            ? [new ImportError(nameof(OrderImportRow.OrderId), "Order ID already exists.", value.OrderId)]
            : [];
    }
}

// Host:
builder.Services.AddScoped<IImportRowValidator<OrderImportRow>, UniqueOrderIdValidator>();
```

The interface is asynchronous by design, specifically to support this kind of
I/O-bound validation without a breaking contract change later.

## Blazor Components

### ImportUpload

Renders a native file-upload button (`MudFileUpload` with a `<label for>` activator —
no JS `input.click()` after async interop, which reliably breaks on iOS/Android).

```razor
<ImportUpload TItem="OrderImportRow"
              Format="ImportFormatId.Csv"
              UserId="@currentUserId"
              OnImported="@OnImportDone"
              OnError="@OnImportError" />
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `Format` | `ImportFormatId` | — | Expected source format (required) |
| `SheetName` | `string?` | `null` | Sheet/tab name for Excel |
| `HasHeaderRow` | `bool` | `true` | Whether the first row contains headers |
| `Policy` | `ImportPolicy` | `CollectAll` | Row-error handling policy |
| `UserId` | `string?` | `null` | User ID for audit |
| `OnImported` | `EventCallback<ImportResult<T>>` | — | Raised after a completed import (successful or partially failed) |
| `OnError` | `EventCallback<Exception>` | — | Raised on structural failure. If no delegate is set, the exception is re-thrown |

### ImportErrorGrid

Renders the imported/error summary and a plain `MudTable` error report (row, column,
message, raw value).

```razor
<ImportErrorGrid TItem="OrderImportRow" Result="@lastResult" />
```

Deliberately **not** built on `BwDataView`/`BieberWorks.SDK.UI` — SDK-Import stays a
Tier-1 module without a UI-polish-system dependency, mirroring SDK-Export. A row-error
report has no sorting/persistence/tree-filter requirement, so a plain `MudTable` is
sufficient.

## Async / Jobs Seam

`IImportJobDispatcher` is a seam for offloading large imports to a background job
runner. The default `InlineImportJobDispatcher` is a synchronous passthrough — no
behaviour change unless a host registers its own dispatcher.

### `BieberWorks.SDK.Import.Jobs` (optional package)

Wires the seam to `SDK-Jobs`. Large imports (or ones explicitly marked as
`import.forceAsync`) are persisted via `IFileStorage` (`SDK-Storage`) and scheduled as
a background job instead of running inline; small imports still run synchronously —
no job/storage overhead for a small upload.

**Prerequisites (must be registered in the host; registration order does not matter):**
- `AddImport()` (this module)
- An `IFileStorage` implementation from `SDK-Storage`
- `SDK-Jobs` (`JobsModule`/`AddJobsInMemory()`)

```csharp
// Program.cs — order relative to AddImport() and SDK-Storage does not matter (the
// dispatcher registration uses services.Replace, not TryAdd). A missing IFileStorage
// is detected at host start (options validation with ValidateOnStart) and fails startup
// with an OptionsValidationException naming SDK-Storage — not at registration time.
builder.Services.AddImport(opts => { /* ... */ });
builder.Services.AddImportJobs(builder.Configuration, opts =>
{
    opts.SizeThresholdBytes = 5 * 1024 * 1024; // required — no hardcoded default
});
```

Behaviour:

- A source stream exceeding `SizeThresholdBytes` (or a non-seekable stream, or a
  request whose `Metadata["import.forceAsync"] == "true"`) is persisted to storage and
  scheduled via `IJobScheduler.ScheduleOnceAsync`. `ImportResult<T>.Status` comes back
  as `ImportRunStatus.Queued` with `ImportRunId` set; `Imported`/`Errors`/`TotalRows`
  are empty/zero at that point — poll `IImportRunQueryService.GetRunAsync(importRunId)`
  for the eventual outcome.
- A per-call `ImportRequest<T>.Map` override is **not supported** for async imports —
  `DispatchAsync` throws `NotSupportedException` if both the threshold is exceeded and
  `Map` is set. Register `IImportMap<T>` via DI instead.
- Run status/outcome (including row errors) is persisted in the package's own
  `import_jobs` schema (`ImportJobsDbContext`), migrated automatically at host startup
  via `IModuleInitializer`. Not the Import core's schema (which has none) and not
  `SDK-Jobs`' own `jobs` schema — one DbContext/schema per module.
- If the underlying job is dead-lettered (SDK-Jobs retries exhausted), the run
  transitions to `ImportRunStatus.Failed` automatically (subscribed via
  `JobDeadLetteredEvent`) — it never stays "Queued/Running" forever, and callers can
  distinguish a real failure from a successful-but-empty `Completed` result.
- The `ImportUpload` MudBlazor component (`Import.UI.Blazor.MudBlazor`) polls
  `IImportRunQueryService` automatically when a result comes back `Queued` — resolved
  optionally (`GetService`, not `GetRequiredService`), so the synchronous path is
  entirely unaffected when `Import.Jobs` is not registered.

**Not released independently.** `Import.Jobs` depends on `SDK-Jobs`, which is not yet
released (main/staging) at the time this package was introduced — it is dev-only in
the local NuGet feed until `SDK-Jobs` itself is released.

## Audit

Every import raises an `ImportedEvent` which implements `IAuditableEvent`.
As long as `BieberWorks.SDK.Audit` is registered in the host, every import is
automatically logged, including `ImportedCount` and `ErrorCount`.

## Notes

- Excel parsing buffers non-seekable source streams into a `MemoryStream` before
  invoking ClosedXML (which requires a seekable stream). For very large files this is
  a memory consideration; enforce a file-size limit at the host's upload endpoint.
- CSV parsing uses `CultureInfo.InvariantCulture` (comma-separated, period decimal
  separator). A delimiter override is not currently exposed on `ImportRequest<T>`.
