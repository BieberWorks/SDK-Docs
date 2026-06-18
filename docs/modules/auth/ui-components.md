# UI Components

The package `BieberWorks.SDK.Auth.UI.MudBlazor` contains ready-made Blazor pages and components based on MudBlazor 9. Each page consists of two layers:

- **`Auth.UI`** — abstract `ComponentBase` base class with all logic (injections, event handlers, state)
- **`Auth.UI.MudBlazor`** — Razor file that simply `@inherits` the base class and renders the MudBlazor markup

## Adding to the host

### 1. Reference the NuGet package

```bash
dotnet add package BieberWorks.SDK.Auth.UI.MudBlazor
```

### 2. Register assembly in Program.cs

```csharp
builder.Services
    .AddRazorComponents()
    .AddInteractiveServerComponents()
    .AddAdditionalAssemblies(
        typeof(BieberWorks.SDK.Auth.UI.MudBlazor._Imports).Assembly
    );
```

### 3. Add assembly to Router (Routes.razor)

```razor
<Router AppAssembly="typeof(App).Assembly"
        AdditionalAssemblies="new[] { typeof(BieberWorks.SDK.Auth.UI.MudBlazor._Imports).Assembly }">
    <Found Context="routeData">
        <RouteView RouteData="routeData" DefaultLayout="typeof(MainLayout)" />
    </Found>
</Router>
```

::: warning Both entries are necessary
`AddAdditionalAssemblies` in `Program.cs` alone is not enough — the `Router` only renders pages from foreign assemblies if the assembly is also registered there. If the router entry is missing, all Auth pages show "Not found".
:::

## Included pages

### Public pages

| Page | Route | Description |
|---|---|---|
| `Login.razor` | `/auth/login` | Login form with email/username, password, "remember me"; supports `?returnUrl=` |
| `Register.razor` | `/auth/register` | Registration form (email, password, confirmation) |
| `ForgotPassword.razor` | `/auth/forgot-password` | Email input for password reset link |
| `ResetPassword.razor` | `/auth/reset-password` | Set new password via `?email=&token=` from reset link |
| `Logout.razor` | `/auth/logout` | Calls `IAuthClient.LogoutAsync()` and navigates to home |

### Account pages (require login)

| Page | Route | IAccountPage |
|---|---|---|
| `Profile.razor` | `/auth/profile`, `/account/profile` | Yes — appears in account navigation |
| `Security.razor` | `/account/security` | Yes — change password |
| `AvatarPage.razor` | `/account/avatar` | Yes — upload avatar (requires `SDK-Storage`) |

### Admin pages (require permissions)

| Page | Route | Required permission |
|---|---|---|
| `UserListPage.razor` | `/admin/users` | `auth:users:read` |
| `UserDetailPage.razor` | `/admin/users/{userId}` | `auth:users:read` |
| `RoleListPage.razor` | `/admin/roles` | `auth:roles:read` |
| `RoleEditPage.razor` | `/admin/roles/{roleId}` | `auth:roles:manage` |

Admin pages implement `IAdminPage` and automatically appear in admin navigation when `SDK-Admin` is also installed.

## Included components

### UserMenu.razor

Shows a user menu in the AppBar (name, avatar initials, logout link). Implements `IAppBarComponent` from `SDK-UI`.

```razor
@* Include in your own AppBar component: *@
@foreach (var component in AppBarComponents)
{
    <DynamicComponent Type="component.GetType()" />
}
```

## Localization

All text is loaded via `IStringLocalizer<AuthResources>`. The module provides embedded `.resx` files for German and English. With `SDK-Localization`, individual texts can be overridden from the database at runtime.

## IAuthClient

The UI pages communicate exclusively with the backend via `IAuthClient` (from `Auth.Contracts`). In the same process (Blazor Server), `InProcAuthClient` is registered. For external clients (WASM/MAUI), `Auth.Client` provides the `HttpAuthClient` implementation:

```csharp
// In a WASM/MAUI app:
builder.Services.AddAuthHttpClient("https://api.example.com/");
```

`AddAuthHttpClient` registers `HttpAuthClient` as `IAuthClient` with a named `HttpClient`.

## Validation Attributes

The `Auth.UI` package contains localized DataAnnotations attributes for form validation:

| Attribute | Description |
|---|---|
| `LocalizedRequiredAttribute` | Required field with localized error message |
| `LocalizedEmailAddressAttribute` | Email format check |
| `LocalizedMinLengthAttribute` | Minimum length |
| `LocalizedStringLengthAttribute` | Min/max length |
| `LocalizedCompareAttribute` | Compare two fields (e.g., password confirmation) |
| `LocalizedRegexAttribute` | Regex check |

These attributes read their error messages from `IStringLocalizer<AuthResources>` and are fully integrated into the localization system.
