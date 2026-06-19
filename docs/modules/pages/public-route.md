# Public Route — SDK-Pages

The public page component renders content pages accessible to site visitors. It handles 404 semantics, role-based access, and configurable route prefixes.

## Route

`PublicPage.razor` declares two `@page` directives:

```razor
@page "/p/{Slug}"
@page "/{Slug}"
```

At runtime, only one prefix is active depending on `PagesOptions.RoutePrefix`:

- `RoutePrefix = "p"` (default) → use `/p/{slug}`
- `RoutePrefix = ""` → use `/{slug}`

Both directives are always compiled into the assembly; the correct one is matched by the router based on the actual URL structure.

## 404 Semantics

`IPageService.GetPublishedBySlugAsync` returns `null` in two cases:

1. No page exists with the given slug.
2. A page exists but its status is `Draft`.

In both cases `PublicPageBase` sets `NotFound = true` and the component renders the `Pages.Public.NotFound` localization string. The response is a 404, not a 401 or 403.

## RequiredRole Flow

When a published page has `RequiredRole` set:

| User state | Behavior |
|---|---|
| Not authenticated | Redirect to `/account/login?returnUrl={current-url}` |
| Authenticated, does not have the role | `AccessDenied = true` → `PagesAccessDenied` component rendered |
| Authenticated, has the role | Page content rendered normally |

The check is performed in `PublicPageBase.OnParametersSetAsync` using `ClaimsPrincipal.IsInRole(role)`. No call to `IPermissionService` is made — role membership is checked directly on the identity claims.

### PagesAccessDenied Component

```razor
@inject IStringLocalizer<PagesUiMudBlazorModule> L

<MudAlert Severity="Severity.Error">@L["Pages.AccessDenied"]</MudAlert>
```

Located in `src/BieberWorks.SDK.Pages.UI.MudBlazor/Components/PagesAccessDenied.razor`.

## PagesOptions.RoutePrefix Configuration

```csharp
public sealed class PagesOptions
{
    /// <summary>
    /// Prefix for all public page routes.
    /// "" = no prefix → /{slug}
    /// Default: "p" → /p/{slug}
    /// </summary>
    public string RoutePrefix { get; set; } = "p";

    /// <summary>
    /// Optional callback to validate slugs against reserved host routes.
    /// Return null if the slug is valid, otherwise return an error message.
    /// </summary>
    public Func<string, string?>? RouteConflictValidator { get; set; }
}
```

Configure via `AddPagesModule`:

```csharp
// No prefix: pages accessible at /{slug}
builder.Services.AddPagesModule(builder.Configuration, o => o.RoutePrefix = "");

// With conflict validator:
builder.Services.AddPagesModule(builder.Configuration, o =>
{
    o.RoutePrefix = "";
    o.RouteConflictValidator = slug =>
        ReservedRoutes.Contains(slug)
            ? $"Route /{slug} is reserved by the application."
            : null;
});
```

## RouteConflictValidator

When set, the validator is called in `PageAdminService.CreateAsync` and `UpdateAsync` before any database write:

```csharp
if (_options.RouteConflictValidator is { } validator)
{
    var routeError = validator(slug);
    if (routeError is not null)
        return Result.Failure<PageDto>(routeError);
}
```

The error message is the consumer's responsibility. The localization key `Pages.Route.Conflict` is available as a convention: `string.Format(L["Pages.Route.Conflict"], slug)`.

If no validator is set, slug uniqueness is only enforced within the pages table (unique DB index on `Slug`).
