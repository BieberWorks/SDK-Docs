# Overview — SDK-Pages

> For the module summary, package table, and documentation TOC see [index.md](index.md).

## PostgreSQL Schema

All tables live in the isolated `pages` schema. No DB-JOINs to other modules — cross-module communication uses IDs, contracts, and domain events only.

| Table | Purpose |
|---|---|
| `pages.pages` | Static content pages (slug, status, shared meta, role, category) |
| `pages.page_translations` | Culture-specific content (Title, Body, MetaDescription) — 1:n to pages |
| `pages.__EFMigrationsHistory` | EF migrations tracking |

See [content-model.md](content-model.md) for the full entity definition, culture-resolution strategy, and migration guide.

## Core Abstractions

### IPageService

Public read-only API, no authentication required. Returns only `Published` pages.
Content is resolved for the requested culture with automatic fallback (see [content-model.md](content-model.md)).

```csharp
public interface IPageService
{
    Task<PageDto?> GetPublishedBySlugAsync(string slug, string? culture = null, CancellationToken ct = default);
}
```

### IPageAdminService

Admin write API. All mutating methods enforce permissions via `IPermissionService` and return `Result`/`Result<T>` — never throw for business errors.

```csharp
public interface IPageAdminService
{
    Task<IReadOnlyList<PageSummaryDto>> GetAllAsync(string? culture = null, CancellationToken ct = default);
    Task<PagedResult<PageSummaryDto>> GetPagedAsync(int page = 1, int pageSize = 50, string? culture = null, CancellationToken ct = default);
    Task<PageDto?> GetByIdAsync(Guid id, string? culture = null, CancellationToken ct = default);
    Task<Result<PageDto>> CreateAsync(CreatePageRequest request, string? createdBy = null, CancellationToken ct = default);
    Task<Result<PageDto>> UpdateAsync(UpdatePageRequest request, string? updatedBy = null, CancellationToken ct = default);
    Task<Result> PublishAsync(Guid id, string? publishedBy = null, CancellationToken ct = default);
    Task<Result> UnpublishAsync(Guid id, string? unpublishedBy = null, CancellationToken ct = default);
    Task<Result> DeleteAsync(Guid id, string? deletedBy = null, CancellationToken ct = default);
    Task<bool> SlugExistsAsync(string slug, Guid? excludeId = null, CancellationToken ct = default);
}
```

## Page Lifecycle

```
Draft  ──[Publish]──▶  Published  ──[Unpublish]──▶  Draft
                           │
                        [Delete]
                           │
                          ──▶ (hard delete)
```

Draft pages return `null` from `IPageService.GetPublishedBySlugAsync` — the public route renders a 404 response, not a 401.

## Key Features

- **Slug auto-generation** from title (Umlaut normalization, URL-safe characters only)
- **IPageProvider seeding** — consumer modules declare static pages; Pages seeds them on startup if the slug does not yet exist
- **AllowAdminEdit** flag — pages seeded with `AllowAdminEdit: false` are read-only in the admin UI
- **RequiredRole** — optional role restriction on the public route; anonymous users are redirected to login, authenticated users without the role see the `PagesAccessDenied` component
- **`PagesOptions.RoutePrefix`** — configurable global fallback prefix for public routes (default `"p"` → `/p/{slug}`, empty string → `/{slug}`)
- **PagesOptions.CategoryPrefixes** — optional per-category prefix map; a page with `Category = "blog"` and `CategoryPrefixes["blog"] = "blog"` resolves to `/blog/{slug}` instead of the global prefix
- **PageEntity.Category** — optional nullable string field; `null` means the global `RoutePrefix` applies; set to a category name to activate a per-category prefix
- **RouteConflictValidator** — optional callback to block slugs that conflict with existing host routes
- **Auto-auditing** — all five domain events implement `IAuditableEvent`; SDK-Audit's open-generic handler logs them automatically
