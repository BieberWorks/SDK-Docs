# Manuelle Integration

This guide walks through setting up a Blazor Server host that uses the BieberWorks SDK modules. The example is based on the working Sandbox host in the SDK repository.

## Prerequisites

- **.NET 10 SDK** — `dotnet --version` must show `10.x`
- **PostgreSQL** — local dev:
  ```bash
  docker run -d --name bieberworks-pg \
    -e POSTGRES_USER=bieberworks \
    -e POSTGRES_PASSWORD=yourpassword \
    -e POSTGRES_DB=bieberworks_app \
    -p 5432:5432 postgres:16
  ```
- **GitHub account** with `read:packages` access to the `BieberWorks` organization — required to restore SDK NuGet packages

## NuGet Access

Create a `nuget.config` in your solution root:

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <clear />
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" protocolVersion="3" />
    <add key="bieberworks" value="https://nuget.pkg.github.com/BieberWorks/index.json" />
  </packageSources>
  <packageSourceCredentials>
    <bieberworks>
      <add key="Username" value="GITHUB_USER" />
      <add key="ClearTextPassword" value="PACKAGES_TOKEN" />
    </bieberworks>
  </packageSourceCredentials>
</configuration>
```

Replace `GITHUB_USER` with your GitHub username and `PACKAGES_TOKEN` with a GitHub PAT that has the `read:packages` scope.

::: warning Do not commit the token
Store the token as an environment variable — not in the file itself. See [NuGet Access](/guide/nuget-access) for the full setup including CI/CD pipelines.
:::

## Package References

Add to your host `.csproj` — adjust to include only the modules you need:

```xml
<ItemGroup>
  <!-- Foundation (always required) -->
  <PackageReference Include="BieberWorks.SDK.Core.Web" Version="0.*-*" />

  <!-- Auth -->
  <PackageReference Include="BieberWorks.SDK.Auth" Version="0.*-*" />
  <PackageReference Include="BieberWorks.SDK.Auth.UI.MudBlazor" Version="0.*-*" />

  <!-- UI shell (required by Admin and Account) -->
  <PackageReference Include="BieberWorks.SDK.UI.MudBlazor" Version="0.*-*" />

  <!-- Admin shell -->
  <PackageReference Include="BieberWorks.SDK.Admin.UI.MudBlazor" Version="0.*-*" />

  <!-- Account shell -->
  <PackageReference Include="BieberWorks.SDK.Account.UI.MudBlazor" Version="0.*-*" />

  <!-- Audit (optional) -->
  <PackageReference Include="BieberWorks.SDK.Audit.UI.MudBlazor" Version="0.*-*" />
</ItemGroup>
```

## Program.cs

The following is based on the Sandbox host — the canonical setup order:

```csharp
using BieberWorks.SDK.Account.UI.MudBlazor.Extensions;
using BieberWorks.SDK.Admin.UI.MudBlazor.Extensions;
using BieberWorks.SDK.Audit.UI.MudBlazor.Extensions;
using BieberWorks.SDK.Auth.UI.MudBlazor.Extensions;
using BieberWorks.SDK.UI.MudBlazor.Extensions;
using BieberWorks.SDK.Core.Modularity;
using BieberWorks.SDK.Core.Web.Modularity;

var builder = WebApplication.CreateBuilder(args);

// Discovers all IModule implementations in the dependency graph and calls
// RegisterServices on each of them exactly once.
// AuthModule, AuditModule, StorageModule, etc. all self-register here.
builder.Services.AddBieberWorksModules(builder.Configuration);

// Blazor Server
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();

builder.Services.AddCascadingAuthenticationState();

// UI shells — order matters: UI first, then Admin and Account which depend on it
builder.Services.AddBieberWorksUi();
builder.Services.AddBieberWorksAdmin();
builder.Services.AddBieberWorksAccount();

// Audit UI (optional — only if SDK-Audit package is referenced)
builder.Services.AddAuditUi();

var app = builder.Build();

// Run EF Core migrations for all modules that implement IModuleInitializer
await app.InitializeBieberWorksModulesAsync();

app.UseStaticFiles();
app.UseAntiforgery();
app.UseAuthentication();
app.UseAuthorization();

// Maps Minimal API routes registered by all IEndpointModule implementations
app.MapBieberWorksModules();

// Auto-discovers all loaded BieberWorks.SDK.*.MudBlazor assemblies
app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode()
    .AddBwModuleAssemblies(typeof(Program).Assembly);

await app.RunAsync();
```

::: info Module discovery
`AddBieberWorksModules` scans the dependency graph via `DependencyContext.Default`. Any NuGet package containing an `IModule` implementation is picked up automatically — no explicit `AddModule<T>()` call needed.
:::

::: warning Middleware order
`UseAuthentication()` must come before `UseAuthorization()`. Both must come after `UseStaticFiles()` and before `MapBieberWorksModules()`.
:::

## Routes.razor

`BwThemeProvider` must be the outermost element. `BwRouter` handles route conflict resolution between host `@page` directives and SDK module routes.

```razor
@using BieberWorks.SDK.Admin.UI.MudBlazor.Layout
@using BieberWorks.SDK.Account.Contracts
@using BieberWorks.SDK.Account.UI.MudBlazor.Layout
@using BieberWorks.SDK.UI.MudBlazor.Components
@using BieberWorks.SDK.UI.MudBlazor.Routing

<BwThemeProvider>
<BwRouter AppAssembly="typeof(App).Assembly">
    <Found Context="routeData">
        <AuthorizeRouteView RouteData="routeData"
                            DefaultLayout="@(typeof(IAdminPage).IsAssignableFrom(routeData.PageType)
                                             ? typeof(AdminLayout)
                                             : typeof(IAccountPage).IsAssignableFrom(routeData.PageType)
                                                 ? typeof(AccountLayout)
                                                 : typeof(MainLayout))">
            <NotAuthorized>
                <!-- redirect to login or show access denied -->
            </NotAuthorized>
        </AuthorizeRouteView>
        <FocusOnNavigate RouteData="routeData" Selector="h1" />
    </Found>
</BwRouter>
</BwThemeProvider>
```

::: warning BwThemeProvider uniqueness
`BwThemeProvider` must appear exactly once in `Routes.razor`. Never put it inside a layout — multiple instances create competing theme states.
:::

## appsettings.json

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "ConnectionStrings": {
    "AuthDb": "Host=localhost;Port=5432;Database=bieberworks_app;Username=bieberworks;Password=PLACEHOLDER_SET_VIA_USER_SECRETS"
  },
  "Email": {
    "UseSmtp": false
  },
  "JwtSettings": {
    "Issuer": "BieberWorks",
    "Audience": "BieberWorks.App",
    "AccessTokenExpirationMinutes": 60,
    "RefreshTokenExpirationDays": 7
  }
}
```

::: tip Email in local dev
`UseSmtp: false` activates the `LoggingEmailSender` fallback — outgoing emails are written to the console log instead of being sent. No SMTP server needed for local development.
:::

::: warning JwtSettings:Secret
The JWT signing secret must be set via user secrets or an environment variable, not in `appsettings.json`:
```bash
dotnet user-secrets set "JwtSettings:Secret" "your-32-char-minimum-secret-here"
```
:::

## Connection String Lookup Order

Each module tries its own named connection string first, then falls back to `DefaultConnection`. You can use a single `DefaultConnection` for all modules, or separate connection strings for finer control.

| Module | Tries first | Falls back to |
|---|---|---|
| Auth | `AuthDb` | `DefaultConnection` |
| Audit | `AuditDb` | `DefaultConnection` |
| Storage | `StorageDb` | `DefaultConnection` |
| Settings | `SettingsDb` | `DefaultConnection` |
| Localization | `LocalizationDb` | `DefaultConnection` |
| Notifications | `NotificationsDb` | `DefaultConnection` |

## Next Steps

- [NuGet Access](/guide/nuget-access) — PAT setup, CI/CD, local feed
- [Create a Module](/guide/create-module) — build your own domain module
- [Migrations](/guide/migrations) — migration strategy, rollback, multi-instance
- [Cross-Module Integration](/guide/cross-module) — event flow, extension points, dependency rules
- [Auth Module](/modules/auth/)
- [Storage Module](/modules/storage/)
