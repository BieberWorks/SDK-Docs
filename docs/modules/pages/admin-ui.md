# Admin UI — SDK-Pages

The admin UI is provided by the `BieberWorks.SDK.Pages.UI.MudBlazor` package. It integrates into the Admin Shell via `IAdminSection`.

## Routes

| Route | Component | Required Permission |
|---|---|---|
| `/admin/pages` | `PagesListPage.razor` | `pages:pages:read` |
| `/admin/pages/create` | `PageCreatePage.razor` | `pages:pages:create` |
| `/admin/pages/{Id}/edit` | `PageEditPage.razor` | `pages:pages:edit` |

## Page List (`/admin/pages`)

The list page shows all pages regardless of status (Draft and Published). Columns:

| Column | Source |
|---|---|
| Title | `PageSummaryDto.Title` |
| Slug | `PageSummaryDto.Slug` |
| Status | `PageSummaryDto.Status` — rendered as a badge (Draft/Published) |
| Visibility | Lock badge when `RequiredRole != null`: `Pages.RequiredRole.Restricted` key with the role name |
| Last modified | `PageSummaryDto.UpdatedAt` |
| Actions | Edit / Publish / Unpublish / Delete — visible only when the user has the corresponding permission |

## Create Page (`/admin/pages/create`)

Fields:

| Field | Key | Notes |
|---|---|---|
| Title | `Pages.TitleLabel` | Required |
| Slug | `Pages.Slug` | Optional — auto-generated from Title if left empty (`Pages.SlugHint` helper text) |
| Content | `Pages.Body` | Markdown editor (`MarkdownEditor` component from SDK-Components) |
| Meta Title | `Pages.MetaTitle` | Optional |
| Meta Description | `Pages.MetaDescription` | Optional |
| Visibility | `Pages.RequiredRole` | Dropdown (when `IRoleProvider` registered) or free-text fallback; `null` = public |
| Public URL preview | `Pages.Route.Preview` | Shows the computed route (`/p/{slug}` or `/{slug}` depending on `PagesOptions.RoutePrefix`) |

After successful creation the user is redirected to `/admin/pages`.

## Edit Page (`/admin/pages/{Id}/edit`)

The `Id` route segment is bound as a `string` and parsed with `Guid.TryParse`. An
invalid id renders the standard "not found" state instead of throwing a
parameter-cast error, so malformed URLs degrade gracefully.

Same fields as Create, pre-populated from the existing `PageDto`. Additional controls:

- **Status toggle:** Publish / Unpublish button (requires `pages:pages:publish` permission).
- **Delete button:** Requires `pages:pages:delete` permission. Shows confirmation dialog.

### AllowAdminEdit Banner

When `PageDto.AllowAdminEdit == false` (page managed by an `IPageProvider` with `AllowAdminEdit: false`):

- An info banner is shown at the top of the form using the `Pages.ManagedByProvider` localization key.
- All input fields are rendered with `Disabled="true"`.
- The Save button is hidden.
- Publish/Unpublish and Delete buttons remain functional (managed pages can still be published or deleted by admins with the right permissions).

### Lock Badge

In `PageEditPage`, a lock badge is displayed next to the page title when `RequiredRole` is set, indicating restricted visibility.

## Admin Section Registration

`PagesAdminSection` registers the module in the Admin Shell navigation:

```csharp
public sealed class PagesAdminSection : IAdminSection
{
    public string Title => "Seiten";
    public string Icon  => Icons.Material.Filled.Article;
    public int    Order => 50;

    public IReadOnlyList<AdminNavItem> NavItems =>
    [
        new("Alle Seiten", "/admin/pages", Icons.Material.Filled.List),
    ];
}
```

The section appears in the Admin Shell sidebar under order 50.

## Registration

```csharp
// Program.cs
builder.Services.AddPagesUi();
```

This registers `IAdminSection` and calls `AddLocalization()` (idempotent).
