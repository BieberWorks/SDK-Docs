# Role-Based Access — SDK-Pages

SDK-Pages supports optional role-based visibility for public pages via the `RequiredRole` field on `PageEntity`. This is distinct from the admin permission system (see [permissions.md](permissions.md)).

## IRoleProvider

`IRoleProvider` is defined in `BieberWorks.SDK.Pages.Contracts` and implemented by SDK-Auth:

```csharp
// BieberWorks.SDK.Pages.Contracts.IRoleProvider
public interface IRoleProvider
{
    Task<IReadOnlyList<string>> GetRoleNamesAsync(CancellationToken ct = default);
}
```

**Separation of concerns:**
- Pages.Contracts defines the interface — Pages has no dependency on Auth or Auth.Contracts.
- SDK-Auth registers its implementation. The Pages module does not register any `IRoleProvider`.
- This keeps Pages usable without SDK-Auth (role restriction simply shows an empty dropdown / free-text fallback in the admin UI).

## IEnumerable Pattern

The admin base classes (`PageCreatePageBase`, `PageEditPageBase`) inject `IEnumerable<IRoleProvider>`:

```csharp
[Inject] protected IEnumerable<IRoleProvider> RoleProviders { get; set; } = default!;

protected override async Task OnInitializedAsync()
    => AvailableRoles = await (RoleProviders.FirstOrDefault()?.GetRoleNamesAsync()
        ?? Task.FromResult<IReadOnlyList<string>>([]));
```

- If SDK-Auth is installed: `RoleProviders.FirstOrDefault()` returns the Auth implementation, `AvailableRoles` is populated from the role store.
- If no `IRoleProvider` is registered: `FirstOrDefault()` returns `null`, `AvailableRoles` is empty, and the admin UI falls back to a free-text input field.

The order of multiple providers is not guaranteed; only the first provider is used. In practice there will be at most one registered provider (SDK-Auth).

## RequiredRole on PageEntity

`PageEntity.RequiredRole` is a nullable string (max 256 characters):

- `null` — page is publicly accessible to any visitor (anonymous).
- `"Admin"` — only users with the `Admin` role can view the page.
- Any other role name — restricted to that role.

The value is stored verbatim; it is the admin's responsibility to enter a valid role name.

## Public Route Access Flow

Enforced in `PublicPageBase.OnParametersSetAsync`:

```
Page loaded → RequiredRole?
  null   → render page (no auth check)
  "…"    → check authentication:
             not authenticated → Nav.NavigateTo("/account/login?returnUrl=…")
             authenticated     → ClaimsPrincipal.IsInRole(RequiredRole)?
                                  true  → render page
                                  false → AccessDenied = true → PagesAccessDenied component
```

The check uses `ClaimsPrincipal.IsInRole` directly — no call to `IPermissionService`. Role membership is determined by identity claims.

## Admin UI Visibility

In the page list (`/admin/pages`), pages with a non-null `RequiredRole` display a lock badge using the `Pages.RequiredRole.Restricted` localization key:

```razor
@if (context.Item.RequiredRole is not null)
{
    <MudTooltip Text="@string.Format(L["Pages.RequiredRole.Restricted"], context.Item.RequiredRole)">
        <MudIcon Icon="@Icons.Material.Filled.Lock" Size="Size.Small" Color="Color.Warning" />
    </MudTooltip>
}
```

In create/edit forms, the Visibility field is rendered as:

- **Dropdown** (when `IRoleProvider` is registered): includes a "Public (everyone)" option (`null` value) plus all role names.
- **Free-text field** (fallback): accepts any role name string; cleared = public.

## PagesAccessDenied Component

`PagesAccessDenied.razor` is a simple alert component in `Pages.UI.Blazor.MudBlazor/Components/`:

```razor
@inject IStringLocalizer<PagesResources> L

<MudAlert Severity="Severity.Error">@L["Pages.AccessDenied"]</MudAlert>
```

Rendered when `PublicPageBase.AccessDenied == true` (authenticated user lacks the required role).
