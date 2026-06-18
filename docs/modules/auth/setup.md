# Setup & Configuration

## NuGet Installation

```bash
dotnet add package BieberWorks.SDK.Auth
dotnet add package BieberWorks.SDK.Auth.Management   # optional: admin endpoints
dotnet add package BieberWorks.SDK.Auth.UI.MudBlazor  # optional: Blazor pages
```

Other modules that only need `ICurrentUserProvider` or permission contracts:

```bash
dotnet add package BieberWorks.SDK.Auth.Contracts
```

## Program.cs

The order of calls is mandatory — `AddBieberWorksModules` must collect all registered `IModule` implementations before the pipeline is built.

```csharp
using BieberWorks.SDK.Auth;
using BieberWorks.SDK.Auth.Management;
using BieberWorks.SDK.Core.Web.Modularity;

var builder = WebApplication.CreateBuilder(args);

// 1. Register all IModule implementations via self-wiring
builder.Services.AddBieberWorksModules(builder.Configuration,
    new AuthModule(),
    new UserManagementModule()   // optional
);

// 2. Register Blazor component assemblies (if Auth.UI.MudBlazor is used)
builder.Services
    .AddRazorComponents()
    .AddInteractiveServerComponents()
    .AddAdditionalAssemblies(
        typeof(BieberWorks.SDK.Auth.UI.MudBlazor._Imports).Assembly
    );

var app = builder.Build();

// 3. Middleware order: Auth before Authorization
app.UseAuthentication();
app.UseAuthorization();

// 4. Map endpoints of all IEndpointModule
app.MapBieberWorksModules();

// 5. Run EF Core migrations + startup tasks (roles, permissions)
await app.InitializeBieberWorksModulesAsync();

await app.RunAsync();
```

::: warning Note the order
`UseAuthentication()` must come **before** `UseAuthorization()`. `InitializeBieberWorksModulesAsync()` runs EF migrations and `PermissionStartupTasks` — this must complete before the first request.
:::

## appsettings.json

### Database connection

The Auth module uses the connection string `AuthDb` by default. If not set, it falls back to `DefaultConnection`.

```json
{
  "ConnectionStrings": {
    "AuthDb": "Host=localhost;Port=5432;Database=bieberworks;Username=postgres;Password=secret"
  }
}
```

### JWT configuration

All JWT settings are bound from the `JwtSettings` section (`JwtSettings.SectionName = "JwtSettings"`).

```json
{
  "JwtSettings": {
    "Secret": "at-least-32-character-long-key",
    "Issuer": "https://my-app.example.com",
    "Audience": "https://my-app.example.com",
    "AccessTokenExpirationMinutes": 60,
    "RefreshTokenExpirationDays": 30
  }
}
```

| Property | Type | Description |
|---|---|---|
| `Secret` | `string` | HMAC-SHA256 key; at least 32 characters recommended |
| `Issuer` | `string` | JWT `iss` claim; must match `ValidIssuer` during validation |
| `Audience` | `string` | JWT `aud` claim |
| `AccessTokenExpirationMinutes` | `int` | Access token validity in minutes |
| `RefreshTokenExpirationDays` | `int` | Refresh token validity in days |

::: danger Secret from configuration
The `Secret` must **never** end up in versioned files. Use `dotnet user-secrets` for local development and environment variables / secret manager in production.
:::

### Cookie configuration

Cookie settings are defined in code and come from `AuthModule`:

| Property | Value |
|---|---|
| Cookie name | `bw.auth` |
| `HttpOnly` | `true` |
| `SameSite` | `Strict` |
| `SecurePolicy` | `SameAsRequest` |
| `SlidingExpiration` | `true` |
| Lifetime | 8 hours |

When accessing without a cookie (e.g., API client with `Authorization: Bearer …`), the `Smart` policy scheme automatically switches to JWT Bearer.

## Migrations

The module runs its EF Core migrations automatically on startup (`IModuleInitializer.InitializeAsync`). Manual migration is not necessary. The PostgreSQL schema is named `auth`.

::: info Adding your own migration
```bash
dotnet ef migrations add <Name> --project src/Auth --startup-project <HostProject>
```
The migrations directory is located under `src/Auth/Migrations/`.
:::
