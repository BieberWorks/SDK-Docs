# Setup & Configuration

## NuGet Installation

```bash
dotnet add package BieberWorks.SDK.Auth
dotnet add package BieberWorks.SDK.Auth.Management   # optional: admin endpoints
dotnet add package BieberWorks.SDK.Auth.UI.Blazor.MudBlazor  # optional: Blazor pages
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

// 1b. Optional: configure the AppBar widget (requires Auth.UI.Blazor.MudBlazor)
builder.Services.AddAuthUi(options =>
{
    options.AppBar.ShowLogin = false;             // hide the Login button
    options.AppBar.ShowRegister = false;          // hide the Register button
    options.AppBar.AnonymousMode = AnonymousAppBarMode.IconOnly; // icon only, no label
});

// 2. Register Razor components. Auth.UI.Blazor.MudBlazor pages are picked up
//    automatically by MapRazorComponents<App>().AddBwModuleAssemblies(...) and <BwRouter>.
builder.Services
    .AddRazorComponents()
    .AddInteractiveServerComponents();

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

::: tip Optional: SDK-RateLimiting (as of v3.1.0)
Login and 2FA (verify/resend) rate limiting is implemented via
`BieberWorks.SDK.RateLimiting.Contracts.IRateLimiter`. As of Auth **v3.1.0**,
`BieberWorks.SDK.RateLimiting` is **optional**, not required:

```csharp
builder.Services.AddBieberWorksModules(builder.Configuration,
    new AuthModule(),
    new RateLimitingModule()   // optional — see below
);
```

- **Without** `RateLimitingModule` in the host, Auth automatically falls back to a built-in,
  in-process rate limiter (`AuthFallbackRateLimiter`). It enforces the same default policies
  as before (5 attempts / 15 min lockout for login and 2FA-verify, 60s cooldown for
  2FA-resend) — real, working brute-force protection with zero extra configuration. The
  fallback is volatile (in-memory, single-process) and does not support Settings-overrides or
  the Admin UI.
- **With** `RateLimitingModule` registered, its central implementation is used instead, giving
  you Settings-backed policy overrides, the Admin UI, and shared limits across modules.
- **Known gap:** if the host references the `BieberWorks.SDK.RateLimiting` NuGet package but
  does **not** add `RateLimitingModule` to its module list (e.g. a transitive package
  reference from another module, without actually activating it), Auth still detects the
  package as present and will **not** silently fall back — `InitializeBieberWorksModulesAsync()`
  throws an `InvalidOperationException` at startup instead. Either add `RateLimitingModule` or
  remove the package reference so the built-in fallback can take over.
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

### Return URL configuration

By default only local return URLs are accepted after login. To allow redirects to another application, list its origins:

```json
{
  "BieberWorks": {
    "Auth": {
      "ReturnUrl": {
        "AllowedReturnOrigins": [ "https://app.example.com", "http://localhost:5001" ]
      }
    }
  }
}
```

| Property | Type | Default | Description |
|---|---|---|---|
| `AllowedReturnOrigins` | `string[]` | empty | Origins as `scheme://host[:port]`. No path, wildcard or user info. |

Invalid entries abort host startup (`ValidateOnStart`). A non-loopback `http://` origin is accepted but logs a warning. See [Return URL rules](10-auth-flows.md#return-url-rules).

### Cookie configuration

Cookie behaviour is configured through `AuthCookieOptions` (section `BieberWorks:Auth:Cookie`, or `services.Configure<AuthCookieOptions>(...)` in code). The options are read lazily, so a `Configure` call anywhere in the host takes effect.

| Property | Type | Default | Description |
|---|---|---|---|
| `CookieName` | `string` | `bw.auth` | Name of the auth cookie |
| `PolicySchemeName` | `string` | `Smart` | Policy scheme that selects JWT or cookie |
| `SameSite` | `SameSiteMode` | `Strict` | SameSite mode (see the note below) |
| `SecurePolicy` | `CookieSecurePolicy` | `SameAsRequest` | Secure flag policy |
| `ExpireTimeSpan` | `TimeSpan` | 8 hours | Fallback lifetime for tickets issued without an expiry. Server-side sessions do not use it; see [Sessions](14-sessions.md) for the absolute and idle limits |
| `LoginPath` | `string?` | `/auth/login` | Anonymous browser page requests are redirected here with `?returnUrl=`. `null` or empty keeps the plain `401`. |
| `AccessDeniedPath` | `string?` | `/auth/access-denied` | Signed-in browser page requests without permission are redirected here with `?returnUrl=`. `null` or empty keeps the plain `403`. |
| `NoRedirectPathPrefixes` | `string[]` | `/api`, `/_blazor`, `/_framework`, `/hubs` | Prefixes (matched per path segment) that never get a redirect |
| `Domain` | `string?` | `null` | Cookie domain; `null` = host-only cookie |

`HttpOnly` is always `true`. Sliding expiration is off: the cookie ticket expires at the absolute end of its server-side session and idle time is tracked in the session store ([Sessions](14-sessions.md)).

::: warning API-only hosts
A host that serves only APIs and has no `/auth/login` page should set `LoginPath` and `AccessDeniedPath` to an empty value so that clients keep receiving `401` and `403` instead of a redirect to a missing page.
:::

::: warning Domain
Setting `Domain` (for example `.example.com`) sends the session cookie to **all** subdomains, including ones you do not fully control. Leave it `null` unless you need single sign-on across subdomains.
:::

::: info SameSite=Strict and external links
With `SameSite=Strict` the browser does not send the cookie on navigations that start on another site (a link in an email or on another domain). The first page view then arrives anonymous and is redirected to the login page, even though the user is signed in. Use `Lax` if links from other sites must open signed in.
:::

When accessing without a cookie (e.g., API client with `Authorization: Bearer …`), the `Smart` policy scheme automatically switches to JWT Bearer.

## AppBar widget configuration

`AddAuthUi()` optionally accepts an `Action<AuthUiOptions>` delegate. When omitted, the defaults apply (Login and Register buttons visible, text + icon).

```csharp
builder.Services.AddAuthUi(options =>
{
    // Hide the Login button for anonymous users (route stays reachable)
    options.AppBar.ShowLogin = false;

    // Hide the Register button for anonymous users
    options.AppBar.ShowRegister = false;

    // Anonymous buttons: icon only, no label
    options.AppBar.AnonymousMode = AnonymousAppBarMode.IconOnly;
});
```

| Option | Type | Default | Description |
|---|---|---|---|
| `AppBar.ShowLogin` | `bool` | `true` | Show the Login button for anonymous users (display-only; does not protect `/auth/login`) |
| `AppBar.ShowRegister` | `bool` | `true` | Show the Register button for anonymous users (display-only; does not protect `/auth/register`) |
| `AppBar.AnonymousMode` | `AnonymousAppBarMode` | `Full` | `Full` = text + icon, `IconOnly` = icon only |

> `using BieberWorks.SDK.Auth.UI.Blazor.Options;` is required when referencing `AnonymousAppBarMode` directly.
>
> These flags only hide buttons. To actually disable registration, use the gate in [Registration](11-registration.md).

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
### Token lifetimes

The e-mail confirmation link and the password reset link have a configurable lifetime. The same values drive the validity of the token and the validity text in the mails (<span v-pre>`{{ValidityDuration}}`</span>), so the mail never promises a different duration.

```json
{
  "BieberWorks": {
    "Auth": {
      "TokenLifetimes": {
        "EmailConfirmation": "2.00:00:00",
        "PasswordReset": "01:00:00"
      }
    }
  }
}
```

| Property | Type | Default | Description |
|---|---|---|---|
| `EmailConfirmation` | `TimeSpan` | 24 hours | Validity of newly issued confirmation tokens. Tokens already issued keep their stored expiry. |
| `PasswordReset` | `TimeSpan` | 24 hours | Applied to Identity's `DataProtectionTokenProviderOptions.TokenLifespan`. |

Allowed range is 1 hour to 7 days; other values abort host startup (`ValidateOnStart`). The mail text is rounded to whole hours ("1 hour", "48 hours", "48 Stunden").

::: warning Template overrides in the database
A template override saved in the Email admin UI replaces the shipped default. If it contains a fixed duration such as "48 hours", change it to <span v-pre>`{{ValidityDuration}}`</span>. The default greeting is <span v-pre>`Hello{{ if CustomerName != "" }} {{ CustomerName }}{{ end }},`</span>; overrides should adopt it so that accounts without a name get "Hello," instead of "Hello ,".
:::

## Email Link Base URL

The mail delivery behind `EmailConfirmationRequestedEventHandler` and `PasswordResetRequestedEventHandler` builds absolute links that are embedded in transactional emails.

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

## Mail queue

Confirmation and password-reset mails are delivered by a background worker (see [Background mail delivery](10-auth-flows.md#background-mail-delivery)). All settings are optional.

```json
{
  "BieberWorks": {
    "Auth": {
      "MailQueue": {
        "Capacity": 1000,
        "MaxConcurrency": 2,
        "SendTimeout": "00:00:30",
        "ShutdownDrainTimeout": "00:00:10"
      }
    }
  }
}
```

| Key | Type | Default | Description |
|---|---|---|---|
| `Capacity` | `int` | 1000 | Waiting mails; further mails are dropped, logged and counted (`bieberworks.auth.email.queue_dropped`). |
| `MaxConcurrency` | `int` | 2 | Mails delivered in parallel. |
| `SendTimeout` | `TimeSpan` | 30 s | Upper bound per mail; a timeout counts as a failed send. |
| `ShutdownDrainTimeout` | `TimeSpan` | 10 s | Time to deliver the remaining mails on shutdown. |

Invalid values abort host startup (`ValidateOnStart`).
