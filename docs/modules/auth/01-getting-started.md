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
  as SDK-RateLimiting (sign-in: 5 attempts per 15 minutes; 2FA verify: 5 attempts per
  15 minutes, then a 15-minute lockout; 60s cooldown for 2FA-resend) — real, working brute-force protection with zero extra configuration. The
  fallback is volatile (in-memory, single-process) and does not support Settings-overrides or
  the Admin UI. It follows the same counting semantics as SDK-RateLimiting's in-memory store:
  `PeekAsync` reports the remaining wait time when the budget is used up, a counter from an
  elapsed window no longer counts (also after an expired lockout), and the store is bounded
  (100 000 keys in total, 50 000 per policy, expired counters swept about once a minute). When
  a cap is reached, expired counters go first, then live counters with the fewest hits and the
  earliest window end; active lockouts go last. A flood of one-off keys therefore cannot evict a
  counter with real progress, and a flood in one policy cannot evict counters of another.
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

## Enable the sign-in brake

The brake for failed sign-ins per client address is **off by default**. See [Sign-in brake per client address](10-auth-flows.md#sign-in-brake-per-client-address-opt-in) for behaviour and all options. Minimal activation:

```json
{ "BieberWorks": { "Auth": { "SignIn": { "FailureBrake": { "Enabled": true } } } } }
```

Defaults when enabled: 10 failures per address and window without delay, then +500 ms per failure up to 5 s; 16 parallel checks per address (2 once delayed); 256 delayed requests per process; counted in policy `auth:login-ip` (30 per 15 minutes, never a lockout).

Checklist before enabling it:

1. The host sees the real client address. Behind a reverse proxy or load balancer call `UseForwardedHeaders` with `XForwardedFor` **and** the proxy address in `KnownProxies` or `KnownIPNetworks`. Otherwise all users share the proxy address and are slowed down together. The module logs a warning at start when the brake is enabled and no proxy beyond loopback is trusted.
2. With the BFF, the BFF address must be trusted by the Identity host as well (its `X-Forwarded-For` carries the browser address).
3. Clients, HTTP handlers and proxies must **not retry** `POST` sign-in requests on `429` or timeouts; a retry multiplies the load and extends the delay. Disable resilience/retry handlers for the sign-in route.
4. Keep proxy and client timeouts above `MaxDelay` (plus the BFF delay, see [BFF](17-bff.md#interaction-with-the-identity-sign-in-brake)).
5. Remember the limits: the brake does not stop distributed botnets or IPv6 prefix rotation and its counters are per instance (see [Honest limits of the brake](10-auth-flows.md#honest-limits-of-the-brake)).

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
| `ShutdownDrainTimeout` | `TimeSpan` | 10 s | Time to deliver the remaining mails on shutdown (in-memory queue only). |
| `Durable` | `bool` | `false` | Store mail jobs in the Auth database so a process kill does not lose them. See [Durable mail queue](10-auth-flows.md#durable-mail-queue). |
| `PollInterval` | `TimeSpan` | 1 s | Durable only: how often due jobs are looked up. |
| `LeaseDuration` | `TimeSpan` | 2 min | Durable only: how long a claimed job stays invisible before it is claimed again. |
| `MaxAttempts` | `int` | 8 | Durable only: attempts (exponential backoff, 5 s to 30 min) before a job is parked as dead. |
| `RetentionPeriod` | `TimeSpan` | 1 day | Durable only: how long delivered jobs are kept, without payload, for duplicate detection. |
| `DeadPayloadRetention` | `TimeSpan` | 7 days | Durable only: how long a dead job keeps its payload (clear-text token) for inspection; afterwards the payload is emptied and the row stays. Zero or less keeps it. |

Invalid values abort host startup (`ValidateOnStart`).

### Mail transport security

The mail module (SDK-Email) refuses to start outside Development when the SMTP security mode is `None`. Run production with TLS (`Email:SecurityMode` = `StartTls` or `SslOnConnect`). For an internal relay on a trusted network without TLS you must accept the risk explicitly with `Email__AllowInsecureTransport=true` (environment variable) or `Email:AllowInsecureTransport`; the host then logs a warning at start. Confirmation, reset and 2FA mails contain tokens, so do not send them unencrypted over untrusted networks.

## Upgrading

### Which version contains what

`3.8.0` was only a **hotfix release**: it contains only the fix that rejects 2FA challenge tokens as bearer access tokens. The service-oriented work (JWKS and asymmetric signing, service tokens, the BFF packages `Auth.Bff` and `Auth.Bff.Postgres`, the durable mail queue, the logout route, refresh-token hardening and the 2FA re-authentication below) ships as a **major release, `4.0.0`**, because it contains breaking changes (listed below). There is no `3.9.0`. Do not look for those features in `3.8.0`.

### Breaking changes when moving to 4.0.0

The three breaking changes, in short: (1) the new member `ITokenService.RevokeRefreshTokenAsync` breaks implementers, (2) `disable-2fa` and `regenerate-recovery-codes` answer 403 `Identity.2FA.ReauthRequired` to calls without proof (clients that treat any 403 as "session invalid" should special-case the `ReauthFailed` and `ReauthRequired` codes), and (3) the refresh-token storage format is not backwards compatible (see the rolling-deploy notes). Behaviour changes that clients may notice: replaying a rotated refresh token ends the whole chain, sign-out ends the whole chain, and the anonymous logout route and the 2FA re-authentication are rate limited.

- **`ITokenService` gained a member.** `RevokeRefreshTokenAsync(string refreshToken, CancellationToken ct)` was added to the public interface `BieberWorks.SDK.Auth.Tokens.ITokenService`. Code that only *uses* the interface is unaffected. A class that *implements* `ITokenService` (a replacement token service, or a hand-written test double) must implement the new member; mocking frameworks need no change.
- **`IAuthClient`** gained overloads with a `verification` argument (default interface methods; existing implementers compile unchanged).
- **2FA re-authentication.** `disable-2fa` and `regenerate-recovery-codes` now require a password, recovery code or current 2FA code in the request body. API clients that called them without a body receive `Identity.2FA.ReauthRequired` (403). See [Disable 2FA and regenerate recovery codes](10-auth-flows.md#disable-2fa-and-regenerate-recovery-codes).
- **Refresh tokens are stored hashed** and reuse revokes the token family; the migration `HashRefreshTokensAddFamily` converts existing rows in place, sessions survive. See [Token Refresh](10-auth-flows.md#token-refresh).
- **Database.** Migrations `AddMailJobs` (new table `auth."MailJobs"`, applied even without the durable queue) and `HashRefreshTokensAddFamily` run on startup. `AddMailJobs` only adds a table. `HashRefreshTokensAddFamily` is **not** purely additive: it adds three columns, rewrites every row of `auth."RefreshTokens"` (new family, hashed token) and creates two indexes, all in one transaction. The table is locked for the duration (logins and refreshes wait), which takes seconds for typical table sizes and longer for millions of rows; plan a window or delete expired tokens first. Its `Down` deletes the hashed tokens, so a rollback ends those sessions. The application database role needs DDL rights as before.
- **Token storage format is not backwards compatible.** Refresh tokens are stored as hashes; an instance of the previous version cannot redeem tokens issued by the new one. See the rolling-deploy notes below.
- **Service accounts are validated at start.** An audience equal to this API's own audience, or a duplicate, empty or colon-containing `ClientId`, now fails the start (`ServiceAccounts` configuration).
- **Mail transport** must use TLS outside Development, or `Email__AllowInsecureTransport=true`. See [Mail transport security](#mail-transport-security).

### Rate-limit behaviour changes after 4.0.0

These are security fixes; the public API is unchanged, so they are not marked as breaking. Clients may notice:

- **Acquire-first sign-in and 2FA limits.** Login, 2FA verify and 2FA resend count every attempt before it is checked, not only failed ones. A burst of parallel attempts no longer exceeds the limit, and attempts for unknown, locked or unconfirmed accounts also use up the budget. A successful sign-in or 2FA verification (including a recovery code) resets the counter. See [Sign-in and 2FA attempt limits](10-auth-flows.md#sign-in-and-2fa-attempt-limits).
- **Lockouts configured on these policies now take effect.** Before, a `LockoutDuration` on the login or 2FA-verify policy was only reached by parallel requests. Hosts that override these policies with a lockout should check the resulting lock time.
- **Sign-in default is 5 attempts per 15 minutes, without a separate lockout.** Before, the code default was 5 per minute plus a 15-minute lockout that was effectively never reached, so about 5 attempts per minute were possible. The wait time now ends with the 15-minute window (the `429` carries the rest of the window as `Retry-After`). A sign-in success resets it. On shared addresses (NAT, or a proxy without trusted forwarded headers) a wrong-password burst can block an account on that address for up to 15 minutes instead of 1; configure `UseForwardedHeaders` correctly (see [Login rate limiting behind a proxy](10-auth-flows.md#login-rate-limiting-behind-a-proxy)). Hosts that override the login policy keep their values.
- **`DomainError.RetryAfter`** is set on the `429` errors of login, 2FA verify and 2FA resend, and the HTTP endpoints now send a `Retry-After` header with it. A host middleware that adds `Retry-After` only when none is present keeps working unchanged.
- **`resend-2fa` `cooldownSeconds`** follows the configured resend policy window instead of a fixed 60.

### Sign-in brake in the next minor release

The sign-in brake is additive: the new options class `AuthSignInFailureBrakeOptions` (property `AuthSignInOptions.FailureBrake`) and the rate-limit policy `auth:login-ip` are new, the brake is disabled by default, and nothing changes for existing hosts until `Enabled` is set. The policy name and the `BieberWorks:Auth:SignIn:FailureBrake` keys are stable. The policy shows up in the SDK-RateLimiting admin list even while the brake is off. See [Enable the sign-in brake](#enable-the-sign-in-brake).

### Rolling deploys and the refresh-token migration

The recommended order is **stop-the-world**: stop all old instances, start one new instance (it applies the migration), then start the others. Sessions survive.

If old and new instances run side by side, even briefly, expect this:

- After the migration an old instance looks tokens up as plain text and finds nothing, so refreshes that reach it answer 403. Clients that treat 403 as "session ended" (the BFF does) sign the user out.
- Tokens issued by a new instance are hashed and cannot be redeemed on an old instance.
- Plain tokens that an old instance wrote after the migration are redeemed by the new instance and rewritten as hashes, so nothing is stranded. Plain values stay in the database only until the token is used, the user logs in again, or it expires.

To keep the mixed phase short, drain old instances before running the migration and shift traffic in one step. There is no supported way to run the old and the new token format in parallel for longer.
