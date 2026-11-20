# Content Model — SDK-Pages

> **BREAKING CHANGE in v0.0.4:** `Title`, `Body`, and `MetaDescription` have been
> moved from `PageEntity` to the new `PageTranslationEntity` (child table).
> `PageDto` no longer carries flat `Title`/`Body`/`MetaDescription` fields —
> see [Migration guide](#migration-guide-for-existing-consumers) below.

## Data Model

### PageEntity (pages.pages)

Holds all culture-independent page data.

| Column | Type | Notes |
|---|---|---|
| `Id` | `uuid` | Primary key |
| `Slug` | `varchar(200)` | Unique, URL-safe identifier |
| `Status` | `int` | `Draft = 0`, `Published = 1` |
| `MetaTitle` | `varchar(200)` | Shared (culture-independent) SEO title |
| `Category` | `varchar(100)` | Optional; used for per-category route prefix |
| `RequiredRole` | `varchar(256)` | Optional role restriction on the public route |
| `AllowAdminEdit` | `bool` | `false` = read-only in admin UI |
| `CreatedAt` | `timestamptz` | |
| `UpdatedAt` | `timestamptz` | |
| `PublishedAt` | `timestamptz?` | Set on first publish |

### PageTranslationEntity (pages.page_translations)

One row per (PageId, Culture). Holds all culture-specific content.

| Column | Type | Notes |
|---|---|---|
| `PageId` | `uuid` | FK → pages.pages(Id), CASCADE DELETE |
| `Culture` | `varchar(10)` | BCP-47 code, e.g. `"en"`, `"de"` |
| `Title` | `varchar(400)` | **Required** |
| `Body` | `text?` | Markdown content |
| `MetaDescription` | `varchar(500)?` | Culture-specific SEO description |

Primary key: **(PageId, Culture)** — enforced at DB level (no two translations per language per page).

## Culture Resolution and Fallback Strategy

`IPageService.GetPublishedBySlugAsync` and `IPageAdminService.GetByIdAsync` both
accept an optional `culture` string. The resolver applies the following strategy
in order:

1. **Exact match** — `"de"` finds a translation with `Culture = "de"`.
2. **Language-only match** — `"de-AT"` finds a translation with `Culture = "de"` (strips the sub-tag).
3. **First available** — alphabetically by `Culture`; deterministic, but application-specific. No "default culture" is stored per page.

The actually applied culture is reported in `PageDto.ResolvedCulture`.
If a page has **no translations at all**, `IPageService` returns `null`
(treated as page not found).

> **Design decision:** There is no fixed "default culture" registered per page in
> the database. The fallback is always the alphabetically first available culture.
> Applications that want a specific fallback (e.g. always "en") should ensure every
> page carries at least an "en" translation, which will then win alphabetically.

## PageDto Shape (after v0.0.4)

```csharp
public sealed record PageDto(
    Guid Id,
    string Slug,
    PageStatus Status,
    string? MetaTitle,               // shared (culture-independent)
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    DateTimeOffset? PublishedAt,
    IReadOnlyList<PageTranslationDto> Translations,  // all stored translations
    string ResolvedCulture,          // culture actually used for resolved fields
    string ResolvedTitle,            // title for ResolvedCulture
    string? ResolvedBody,            // body for ResolvedCulture (null if empty)
    string? ResolvedMetaDescription, // meta-desc for ResolvedCulture
    string? RequiredRole = null,
    bool AllowAdminEdit = true,
    string? Category = null);
```

Public-facing rendering code should use `ResolvedTitle`, `ResolvedBody`, and
`ResolvedMetaDescription`. Admin forms that need to display all languages use
`Translations`.

## Migration Guide for Existing Consumers

### Database

Run `dotnet ef database update` against v0.0.4.
Migration `AddPageTranslations` performs:

1. Creates `pages.page_translations` with composite PK `(PageId, Culture)`.
2. Copies every existing row's `Title`/`Body`/`MetaDescription` into a new translation row
   with `Culture = 'en'` (using `COALESCE(Title, Slug)` to avoid empty-title violations).
3. Drops `Title`, `Body`, `MetaDescription` from `pages.pages`.

**No data loss** — all existing content is preserved as the `"en"` culture variant.
If your existing pages were written in a language other than English, you will need
to re-key the translations manually after migration (change `Culture` from `"en"`
to the correct code).

### Code changes required in consumer projects

| Old API | New API |
|---|---|
| `pageDto.Title` | `pageDto.ResolvedTitle` |
| `pageDto.Body` | `pageDto.ResolvedBody` |
| `pageDto.MetaDescription` | `pageDto.ResolvedMetaDescription` |
| `new CreatePageRequest(Title: …, Body: …, …)` | `new CreatePageRequest(Translations: [new("en", title, body)], …)` |
| `new UpdatePageRequest(Title: …, Body: …, …)` | `new UpdatePageRequest(…, Translations: [new("en", title, body)])` |
| `new ManagedPage("slug", "Title", "Body")` | unchanged (backward-compat constructor still works; creates one `"en"` translation) |
| `IPageAdminService.GetAllAsync()` | `IPageAdminService.GetAllAsync(culture?: string)` |
| `IPageAdminService.GetByIdAsync(id)` | `IPageAdminService.GetByIdAsync(id, culture?: string)` |
| `IPageService.GetPublishedBySlugAsync(slug)` | `IPageService.GetPublishedBySlugAsync(slug, culture?: string)` |
