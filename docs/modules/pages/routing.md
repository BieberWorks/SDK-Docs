# Routing — SDK-Pages

## PagesOptions

`PagesOptions` controls how public page routes are built. Registered as `IOptions<PagesOptions>` in DI.

```csharp
// BieberWorks.SDK.Pages.Contracts.PagesOptions
public sealed class PagesOptions
{
    public string RoutePrefix { get; set; } = "p";
    public Func<string, string?>? RouteConflictValidator { get; set; }
}
```

## PageRouteHelper

Internal static helper used by `PageAdminService` to compute the public URL for a given slug:

```csharp
internal static class PageRouteHelper
{
    public static string BuildRoute(string slug, PagesOptions options)
    {
        return string.IsNullOrEmpty(options.RoutePrefix)
            ? $"/{slug}"
            : $"/{options.RoutePrefix}/{slug}";
    }
}
```

## Route Examples

| `RoutePrefix` | Slug | Resulting route |
|---|---|---|
| `"p"` (default) | `impressum` | `/p/impressum` |
| `"p"` | `datenschutz` | `/p/datenschutz` |
| `""` | `impressum` | `/impressum` |
| `""` | `agb` | `/agb` |
| `"pages"` | `about` | `/pages/about` |

## Configuration

```csharp
// Default (/p/{slug}):
builder.Services.AddBieberWorksModules(builder.Configuration);

// No prefix (/{slug}):
builder.Services.AddPagesModule(builder.Configuration, o => o.RoutePrefix = "");

// Custom prefix (/content/{slug}):
builder.Services.AddPagesModule(builder.Configuration, o => o.RoutePrefix = "content");
```

## RouteConflictValidator

The `RouteConflictValidator` is an optional delegate that runs before a page is created or updated. It receives the computed slug and returns `null` if the route is safe, or an error message if it conflicts with a reserved host route.

```csharp
builder.Services.AddPagesModule(builder.Configuration, o =>
{
    o.RoutePrefix = "";
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

## Blazor Router and Both @page Directives

`PublicPage.razor` always declares both:

```razor
@page "/p/{Slug}"
@page "/{Slug}"
```

The Blazor router matches the URL against the registered route templates. When `RoutePrefix = "p"`, incoming requests to `/p/impressum` match the first directive. When `RoutePrefix = ""`, requests to `/impressum` match the second directive. Having both compiled in means the assembly works correctly regardless of the configured prefix — the host does not need a different assembly per configuration.

If `RoutePrefix` is set to `""` and the host has other components registered at `/{param}` routes, a Blazor route conflict may occur. Use `RouteConflictValidator` to prevent creating slugs that would shadow existing routes.
