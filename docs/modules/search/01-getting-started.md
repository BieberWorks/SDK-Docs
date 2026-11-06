# Getting Started

## Installation

The host references both the provider-neutral core and a concrete provider package:

```xml
<PackageReference Include="BieberWorks.SDK.Search" Version="0.*-*" />
<PackageReference Include="BieberWorks.SDK.Search.Postgres" Version="0.*-*" />
```

Both are self-registering `IModule` implementations discovered by the host's module scanner —
no manual `services.Add...()` call is required beyond the modules being referenced.

## Connection string

`BieberWorks.SDK.Search.Postgres` resolves its connection string in this order: `SearchDb`, then
`DefaultConnection`.

```json
{
  "ConnectionStrings": {
    "SearchDb": "Host=localhost;Database=myapp;Username=postgres;Password=postgres"
  }
}
```

## Registering a searchable entity

A consumer module implements `ISearchableEntitySource<TEntity>` and registers it in its own
`IModule.RegisterServices` — no dependency on the SDK-Search implementation, only on
`BieberWorks.SDK.Search.Contracts`:

```csharp
internal sealed class PageSearchSource(IDbContextFactory<PagesDbContext> factory)
    : ISearchableEntitySource<PageEntity>
{
    public string EntityType => "Pages.Page";

    public SearchDocument ToDocument(PageEntity page) => new(
        Id: $"{EntityType}:{page.Id}",
        EntityType: EntityType,
        EntityId: page.Id.ToString(),
        Title: page.Title,
        Body: page.ContentPlainText,
        AdditionalFields: [new SearchField("tags", string.Join(' ', page.Tags), SearchFieldWeight.D)],
        Language: page.Language,
        PermissionKey: page.RequiredRole is null ? null : "pages:read",
        RequiredRole: page.RequiredRole,
        VisibilityScope: page.IsPublished ? "public" : null,
        DeepLink: $"/{page.Slug}",
        IndexedAtUtc: DateTimeOffset.UtcNow,
        Metadata: new Dictionary<string, string> { ["icon"] = "Icons.Material.Filled.Article" });

    public async IAsyncEnumerable<PageEntity> GetAllAsync(
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        await using var db = await factory.CreateDbContextAsync(cancellationToken);
        await foreach (var page in db.Pages.AsAsyncEnumerable().WithCancellation(cancellationToken))
            yield return page;
    }

    public async Task<PageEntity?> GetByIdAsync(string entityId, CancellationToken cancellationToken = default)
    {
        await using var db = await factory.CreateDbContextAsync(cancellationToken);
        return await db.Pages.FindAsync([Guid.Parse(entityId)], cancellationToken);
    }
}

// in PagesModule.RegisterServices:
services.AddSearchableSource<PageEntity, PageSearchSource>();
```

## Incremental reindex via domain events

Publish an event implementing `ISearchIndexRefreshEvent` (defined in `BieberWorks.SDK.SharedKernel`)
after your own change has committed (via the Outbox). SDK-Search's open-generic handler picks it
up automatically — no dependency on SDK-Search needed in the publishing module, only on
`SharedKernel`:

```csharp
public sealed record PageChangedEvent(Guid PageId, bool Deleted) : ISearchIndexRefreshEvent
{
    public string SearchEntityType => "Pages.Page";
    public string SearchEntityId   => PageId.ToString();
    public SearchIndexChangeKind ChangeKind =>
        Deleted ? SearchIndexChangeKind.Deleted : SearchIndexChangeKind.Upserted;
}
```

## Full reindex

Full reindex is **opt-in**, not automatic on every host start (`SearchOptions.AutoReindexOnStartup`,
default `false`) — a full reindex over a large dataset can meaningfully extend startup time.
Trigger it explicitly via the Admin "Reindex All" page, or enable the startup option for small
datasets:

```json
{ "Search": { "AutoReindexOnStartup": true } }
```

## Querying

```csharp
public sealed class SearchEndpointHandler(ISearchService search)
{
    public Task<SearchResult<SearchHit>> HandleAsync(string q, ClaimsPrincipal user, CancellationToken ct) =>
        search.SearchAsync(new SearchQuery(
            Text: q,
            Language: "en",
            RequestingUserId: user.FindFirstValue(ClaimTypes.NameIdentifier),
            RequestingUserRoles: user.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList(),
            RequestingUserPermissions: /* resolved via IPermissionService */ []), ct);
}
```

::: warning Query Language Must Match Indexing Language
`SearchQuery.Language` selects the PostgreSQL text-search configuration used for the query
(`websearch_to_tsquery`). If it does not match the `Language` a document was indexed with, a
*stemmed* word may fail to match even though the unstemmed text is identical (e.g. an English
document containing "kangaroos" indexed with the `english` config will not match a query for
"kangaroos" run under the `simple` config, because `simple` performs no stemming). Always pass
the same language (or a per-request detected language) consistently between indexing and
querying. See [PostgreSQL Provider](20-postgres-provider.md) for the full language-config mapping.
:::
