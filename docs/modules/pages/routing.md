# Routing — SDK-Pages

## PagesOptions

`PagesOptions` controls how public page routes are built. Registered as `IOptions<PagesOptions>` in DI.

```csharp
public sealed class PagesOptions
{
    /// <summary>
    /// Global fallback prefix for all public page routes.
    /// "" = no prefix → /{slug}.
    /// Default: "p" → /p/{slug}
    /// </summary>
    public string RoutePrefix { get; set; } = "p";

    /// <summary>
    /// Per-category route prefixes.
    /// Key = category name (e.g. "blog"), Value = route prefix (e.g. "blog").
    /// When a page has a Category that matches a key in this dictionary,
    /// that prefix is used instead of RoutePrefix.
    /// Pages with Category = null or an unknown category fall back to RoutePrefix.
    /// </summary>
    public Dictionary<string, string> CategoryPrefixes { get; set; } = [];

    /// <summary>
    /// Optional callback to validate slugs against reserved host routes.
    /// Return null if the slug is valid, otherwise return an error message.
    /// </summary>
    public Func<string, string?>? RouteConflictValidator { get; set; }
}
```

## PageRouteHelper

Internal static helper used by `PageAdminService` to compute the public URL for a given slug:

```csharp
internal static class PageRouteHelper
{
    public static string BuildRoute(string slug, PagesOptions options, string? category = null)
    {
        var prefix = ResolvePrefix(options, category);
        return string.IsNullOrEmpty(prefix) ? $"/{slug}" : $"/{prefix}/{slug}";
    }
}
```

### Prefix resolution order

1. If `category` is non-null and exists as a key in `CategoryPrefixes` → use that value.
2. Otherwise → use global `RoutePrefix` (including empty string).

## Route Examples

| `RoutePrefix` | `CategoryPrefixes` | Page Category | Slug | Resulting route |
|---|---|---|---|---|
| `"p"` (default) | `{}` | `null` | `impressum` | `/p/impressum` |
| `""` | `{}` | `null` | `impressum` | `/impressum` |
| `"p"` | `{"blog": "blog", "legal": "legal"}` | `"blog"` | `my-post` | `/blog/my-post` |
| `"p"` | `{"blog": "blog", "legal": "legal"}` | `"legal"` | `impressum` | `/legal/impressum` |
| `"p"` | `{"blog": "blog"}` | `null` | `about` | `/p/about` |
| `"p"` | `{"blog": "blog"}` | `"faq"` (unknown) | `contact` | `/p/contact` |

## Configuration

```csharp
// Default (/p/{slug}):
builder.Services.AddBieberWorksModules(builder.Configuration);

// No prefix (/{slug}):
builder.Services.AddPagesModule(builder.Configuration, o => o.RoutePrefix = "");

// Multiple category prefixes:
builder.Services.AddPagesModule(builder.Configuration, o =>
{
    o.RoutePrefix = "p";   // fallback for uncategorised pages
    o.CategoryPrefixes = new Dictionary<string, string>
    {
        ["blog"]  = "blog",    // category "blog"  → /blog/{slug}
        ["legal"] = "legal",   // category "legal" → /legal/{slug}
    };
});
```

## RouteConflictValidator

The `RouteConflictValidator` is an optional delegate that runs before a page is created or updated. It receives the computed slug and returns `null` if the route is safe, or an error message if it conflicts with a reserved host route.

```csharp
builder.Services.AddPagesModule(builder.Configuration, o =>
{
    o.RoutePrefix = "";
    o.CategoryPrefixes = new Dictionary<string, string>
    {
        ["blog"] = "blog",
    };
    o.RouteConflictValidator = slug =>
    {
        var reservedRoutes = new[] { "admin", "account", "bw", "api" };
        return reservedRoutes.Contains(slug)
            ? $"Route /{slug} is reserved."
            : null;
    };
});
```

The validator is called in `PageAdminService.CreateAsync` and `UpdateAsync` before any database write. If it returns a non-null string, the method returns `Result.Failure(errorMessage)` and no page is written.

## Blazor Router and @page Directives — Important Limitation

`PublicPage.razor` declares two static route templates:

```razor
@page "/p/{Slug}"
@page "/{Slug}"
```

Blazor `@page` directives are **compiled at build time** — they are static strings, not derived from runtime configuration. This means:

- The two compiled templates (`/p/{Slug}` and `/{Slug}`) handle the two most common configurations (global prefix `"p"` or no prefix `""`).
- **Category-specific prefixes (`/blog/{slug}`, `/legal/{slug}`, etc.) are NOT matched by these static templates.** There is no Razor component registered at `/blog/{Slug}` or `/legal/{slug}`.

### What works with CategoryPrefixes

- **Link generation**: `PageRouteHelper.BuildRoute` (called in `PageAdminService`) correctly computes `/blog/my-post` for a page with `Category = "blog"`. These links appear in the admin UI route preview and in any consumer code that calls `BuildRoute`.
- **IPageProvider seeding**: `ManagedPage` accepts an optional `Category` field; seeded pages will have the correct category in the database.

### What does NOT work without additional host setup

Public navigation to `/blog/{slug}` will result in a Blazor "Not Found" page unless the consuming host application adds its own route-aware component. Two options:

**Option A — Catch-all + dispatch (recommended for multi-prefix):** Add a catch-all component in the host that matches a known prefix, extracts the slug, and delegates to `IPageService.GetPublishedBySlugAsync`. This is 30–50 lines of Blazor and does not require SDK changes.

**Option B — Additional @page directives:** This requires the consumer to create their own Razor component that `@inherits PublicPageBase` and declares `@page "/blog/{Slug}"` etc. This works but couples the host to the exact set of configured prefixes.

The SDK intentionally does not ship hard-coded `/blog/{Slug}` routes because the set of categories is consumer-defined. The `CategoryPrefixes` feature is **complete for link generation and data modeling**; the routing gap is a known, documented limitation.
