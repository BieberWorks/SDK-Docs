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
| `Profile.razor` | `/auth/profile`, `/account/profile` | Yes — change username, change display name, resend confirmation email (see [Profile Self-Service](auth-flows.md#profile-self-service)) |
| `Security.razor` | `/account/security` | Yes — change password and manage two-factor auth (enable/disable, recovery codes; see [Two-Factor](auth-flows.md#two-factor-authentication)) |
| `AvatarPage.razor` | `/account/avatar` | Yes — upload avatar (requires `SDK-Storage`) |

### Admin pages (require permissions)

| Page | Route | Required permission |
|---|---|---|
| `UserListPage.razor` | `/admin/users` | `auth:users:read` |
| `UserDetailPage.razor` | `/admin/users/{userId}` | `auth:users:read` |
| `RoleListPage.razor` | `/admin/roles` | `auth:roles:read` |
| `RoleEditPage.razor` | `/admin/roles/{roleId}` | `auth:roles:manage` |
| `RegistrationSettingsPage.razor` | `/admin/auth/registration` | `auth:registration:manage` |

The registration page toggles self-registration at runtime; see [Registration](registration.md) for the full host-config + admin-toggle gate.

Admin pages implement `IAdminPage` and automatically appear in admin navigation when `SDK-Admin` is also installed.

## Included components

### UserMenu.razor

Renders a user menu in the app bar (avatar/initials, name, email, logout link). Implements `IAppBarWidget` from `SDK-UI` and is wired automatically via DI discovery — no manual Razor code required.

#### Behavior

| State | Default | Configurable |
|---|---|---|
| Authenticated | Avatar icon with dropdown (profile, admin, logout) | — |
| Anonymous | Login + Register as text buttons | `AnonymousMode`, `ShowLogin`, `ShowRegister` |

#### Configuration via `AddAuthUi()`

```csharp
// Program.cs
builder.Services.AddAuthUi(options =>
{
    options.AppBar.ShowLogin = false;     // hide the Login button (route stays reachable)
    options.AppBar.ShowRegister = false;  // hide the Register button
    options.AppBar.AnonymousMode = AnonymousAppBarMode.IconOnly;
});
```

`ShowLogin` and `ShowRegister` are **display-only** — they hide the buttons but do not protect the `/auth/login` or `/auth/register` routes. For a real registration lock, use the gate described in [Registration](registration.md); for a single-user setup, see its [portfolio recipe](registration.md#recipe-single-user--portfolio-setup).

See [Setup → AppBar widget configuration](setup.md#appbar-widget-configuration) for all available options.

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
