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

// 1b. Optional: AppBar-Widget konfigurieren (erfordert Auth.UI.MudBlazor)
builder.Services.AddAuthUi(options =>
{
    options.AppBar.ShowRegister = false;          // Register-Button ausblenden
    options.AppBar.AnonymousMode = AnonymousAppBarMode.IconOnly; // nur Icon, kein Text
});

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

## AppBar-Widget konfigurieren

`AddAuthUi()` akzeptiert optional einen `Action<AuthUiOptions>`-Delegate. Wird er weggelassen, gelten die Defaults (Register-Button sichtbar, Login mit Text+Icon).

```csharp
builder.Services.AddAuthUi(options =>
{
    // Register-Button für anonyme Nutzer ausblenden
    options.AppBar.ShowRegister = false;

    // Login-Button im anonymen Zustand: nur Icon, kein Label
    options.AppBar.AnonymousMode = AnonymousAppBarMode.IconOnly;
});
```

| Option | Typ | Default | Beschreibung |
|---|---|---|---|
| `AppBar.ShowRegister` | `bool` | `true` | Register-Button für anonyme Nutzer anzeigen |
| `AppBar.AnonymousMode` | `AnonymousAppBarMode` | `Full` | `Full` = Text+Icon, `IconOnly` = nur Icon |

> `using BieberWorks.SDK.Auth.UI.Options;` ist nötig, wenn `AnonymousAppBarMode` direkt referenziert wird.

## Admin Bootstrap (first-run seed)

The Auth module can create an initial Admin user on startup so that a fresh deployment has at least one privileged account without custom seeder code. The feature is **opt-in** (`SeedAdmin` defaults to `false`) and **idempotent** — it only runs when no user with the `Admin` role exists yet.

### appsettings.json / environment

```json
{
  "Auth": {
    "Bootstrap": {
      "SeedAdmin": true,
      "Email": "admin@example.com",
      "Password": "<set-via-secrets-not-here>"
    }
  }
}
```

::: danger Password must never be committed
`Auth:Bootstrap:Password` must **not** appear in `appsettings.json` or any file checked into source control. Supply it via `dotnet user-secrets` for local development and via environment variables / a secrets manager in production:

```bash
dotnet user-secrets set "Auth:Bootstrap:Password" "MyStr0ngP@ss!"
```

Or as an environment variable (ASP.NET Core flattens `:` to `__`):

```
Auth__Bootstrap__Password=MyStr0ngP@ss!
```

Change the bootstrap password after the first login.
:::

| Property | Type | Default | Description |
|---|---|---|---|
| `Auth:Bootstrap:SeedAdmin` | `bool` | `false` | Enable the bootstrap seed (opt-in) |
| `Auth:Bootstrap:Email` | `string` | — | E-mail address of the bootstrap admin user |
| `Auth:Bootstrap:Password` | `string` | — | Initial password — supply via user-secrets or env, never appsettings |

If `SeedAdmin` is `true` but `Email` or `Password` is missing, the seeder logs a warning and skips — the application continues to start normally.

## Email Link Base URL

Both `EmailConfirmationRequestedEventHandler` and `PasswordResetRequestedEventHandler` build absolute links that are embedded in transactional emails.

The base URL is resolved in the following order:

| Priority | Source | Key |
|---|---|---|
| 1 | `IConfiguration` | `App:PublicBaseUrl` |
| 2 | Environment variable (back-compat) | `CONFIRM_EMAIL_BASE_URL` / `RESET_PASSWORD_BASE_URL` |
| 3 | (warning logged, link is broken) | — |

**Recommended configuration:**

```json
{
  "App": {
    "PublicBaseUrl": "https://my-app.example.com"
  }
}
```

::: warning No localhost default
Unlike the previous implementation, there is no `http://localhost:5173` fallback. If neither `App:PublicBaseUrl` nor the legacy environment variable is configured, a warning is logged and the link will be broken. Always set `App:PublicBaseUrl` in staging/production appsettings.
:::

The resulting link paths are:

| Flow | Link |
|---|---|
| Email confirmation | `{App:PublicBaseUrl}/auth/confirm-email?userId=…&token=…` |
| Password reset | `{App:PublicBaseUrl}/auth/reset-password?email=…&token=…` |

## Migrations

The module runs its EF Core migrations automatically on startup (`IModuleInitializer.InitializeAsync`). Manual migration is not necessary. The PostgreSQL schema is named `auth`.

::: info Adding your own migration
```bash
dotnet ef migrations add <Name> --project src/Auth --startup-project <HostProject>
```
The migrations directory is located under `src/Auth/Migrations/`.
:::
