# Search

The Search module provides a cross-type, permission-aware full-text search facility for
BieberWorks SDK hosts. Consumer modules (Pages, Wallet, Audit, ...) register which of their
entity types should be searchable ("indexer" registration) without SDK-Search ever referencing
their domain types. Search returns ranked, cross-type hits with snippet/highlight, filtered by
the requesting user's permissions/roles/ownership, plus a deep link back to the original object.

## What the module offers

- **Provider-neutral core** (`BieberWorks.SDK.Search`) — indexer registry, permission-aware
  service facade, incremental reindex via domain events. No EF Core/database dependency.
- **PostgreSQL provider** (`BieberWorks.SDK.Search.Postgres`) — `tsvector`/GIN full-text search,
  multi-language stemming via a per-row `regconfig` mapping, `ts_rank` ranking, `ts_headline`
  snippets with neutral (HTML-free) highlight markers.
- **Declarative indexer registration** — `services.AddSearchableSource<TEntity, TSource>()`;
  SDK-Search never references the consumer's domain assembly.
- **Two-layer permission filtering** — coarse permission/role filter applied server-side by the
  provider, plus a provider-agnostic `VisibilityScope` fine-filter (e.g. `"owner:{userId}"`)
  applied in `ISearchService` as defense in depth.
- **Incremental + full reindex** — consumers publish `ISearchIndexRefreshEvent` (defined in
  `BieberWorks.SDK.SharedKernel`, same pattern as `IAuditableEvent`) after commit via the Outbox;
  a full reindex is available via `ISearchableEntitySourceRegistry.ReindexAllAsync()`, either
  opt-in at startup (`SearchOptions.AutoReindexOnStartup`, default off) or via the Admin UI.
- **Admin UI** — registered entity-type overview with document counts and a manual "Reindex All"
  trigger, in the existing Admin shell (`IAdminSection`/`IAdminPage`).
- **Single active provider by design** — multi-provider aggregation (e.g. a live Postgres→Elastic
  migration) is an intentionally deferred extension, not part of the current architecture.

## Package overview

| Package | Description | When needed |
|---|---|---|
| `BieberWorks.SDK.Search.Contracts` | `SearchDocument`, `SearchQuery`/`SearchHit`/`SearchResult<T>`, `ISearchableEntitySource<T>`, `ISearchProvider`, `ISearchService`, `AddSearchableSource<TEntity,TSource>()` | Always — consumer modules that want to be searchable, and any code that calls `ISearchService` |
| `BieberWorks.SDK.Search` | Provider-neutral core: registry, service, incremental-reindex event handler, `SearchOptions` | In the host providing the Search feature (alongside a provider package) |
| `BieberWorks.SDK.Search.Postgres` | PostgreSQL `tsvector`/GIN provider: `SearchDbContext` (schema `search`), migration, `PostgresSearchProvider` | In the host, as the first concrete backend |
| `BieberWorks.SDK.Search.Presentation` | Framework-neutral `SearchViewModel` (MVVM) | Hosts building a UI on `ISearchService` |
| `BieberWorks.SDK.Search.UI.Blazor` | Framework-agnostic Blazor adapters | Non-MudBlazor Blazor hosts |
| `BieberWorks.SDK.Search.UI.Blazor.MudBlazor` | `BwSearchBox`, `BwSearchResultsPage`, `BwSearchReindexAdminPage` | Hosts using the built-in MudBlazor search UI |

## Documentation

| Topic | Document |
|---|---|
| Installation, `Program.cs`, connection string, indexer registration | [Getting Started](01-getting-started.md) |
| PostgreSQL provider, trigger-based `tsvector` maintenance, language config, raw-SQL query | [PostgreSQL Provider](20-postgres-provider.md) |
| Release history | [Changelog](90-changelog.md) |
