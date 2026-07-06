# Usage Guide

## Getting Started

### NuGet References

```xml
<!-- Core module (service + middleware) -->
<PackageReference Include="BieberWorks.SDK.Maintenance" Version="0.*-*" />

<!-- Admin UI — only when SDK-Admin shell is present -->
<PackageReference Include="BieberWorks.SDK.Maintenance.UI.MudBlazor" Version="0.*-*" />
```

### Registration in Program.cs

```csharp
builder.Services
    .AddBieberWorksSettings()           // prerequisite — also required by Admin
    .AddBieberWorksMaintenance(opts =>
    {
        opts.PagePath = "/maintenance";  // default; override as needed
    })
    .AddBieberWorksMaintenanceUi();     // only when Admin shell is present
```

The `BypassPredicate` has a sensible default (see below) — you only need to override it if the Admin role check is insufficient.

**Middleware placement — must come after `UseAuthentication` and before `UseAuthorization`:**

```csharp
app.UseRouting();
app.UseAuthentication();
app.UseMaintenanceMode();     // <-- after UseAuthentication, before UseAuthorization
app.UseAuthorization();
// ... rest of pipeline
```

The default `BypassPredicate` inspects `HttpContext.User` to bypass authenticated Admins.
That claims principal is only populated once `UseAuthentication()` has run — placing
`UseMaintenanceMode()` *before* `UseAuthentication()` means `ctx.User` is always
anonymous at that point, so the Admin bypass silently never triggers. Keep the
middleware after authentication (and before authorization/endpoints) so the bypass
check works as documented.

### Routes.razor

Add the UI assembly to the Blazor router so `/admin/maintenance` is found:

```razor
<Router AppAssembly="@typeof(App).Assembly"
        AdditionalAssemblies="new[] {
            typeof(BieberWorks.SDK.Maintenance.UI.MudBlazor.MaintenancePage).Assembly
        }">
```

---

## MaintenanceOptions Reference

| Property | Type | Default | Description |
|---|---|---|---|
| `PagePath` | `string` | `/maintenance` | Redirect target for browser requests during maintenance. Consumer-configurable; typically `/maintenance` or `/maint-page`. |
| `AlwaysAllowedPaths` | `IList<string>` | `["/_blazor", "/_framework", "/favicon.ico"]` | Path prefixes that always bypass the middleware. Add consumer paths at startup. **Never remove `/_blazor` or `/_framework`** or Blazor will stop working during maintenance. |
| `BypassPredicate` | `Func<HttpContext, bool>` | Admin role check (see below) | Consumer predicate that runs before `IsEnabledAsync`. Return `true` to unconditionally allow the request, even when maintenance is active. The default checks for the "Admin" role. |

### BypassPredicate Default Behavior

By default, the middleware **automatically bypasses authenticated users with the `Admin` role**, using SDK-Auth's claim shapes:

```csharp
// Default implementation (built-in):
ctx.User.Identity?.IsAuthenticated == true &&
(ctx.User.IsInRole("Admin") ||
 ctx.User.HasClaim("role", "Admin") ||
 ctx.User.HasClaim(ClaimTypes.Role, "Admin"))
```

Admins never see the maintenance page and never get a 503 response — their requests proceed normally regardless of maintenance status. This ensures admin/support staff can always access the application.

**Override if needed:** To change this behavior or allow additional bypasses (e.g., IP whitelist, API keys, health-check tokens):

```csharp
builder.Services.AddBieberWorksMaintenance(opts =>
{
    // Only allow users with Admin role (disable unauthenticated admins)
    opts.BypassPredicate = ctx => ctx.User.IsInRole("Admin");

    // Or: Allow health-check requests
    opts.BypassPredicate = ctx =>
    {
        if (ctx.Request.Path.Value?.Contains("/health") == true)
            return true;
        return ctx.User.IsInRole("Admin");
    };

    // Or: Disable bypass entirely (useful for testing)
    opts.BypassPredicate = _ => false;
});
```

---

## Allowed Paths Configuration

### Using AlwaysAllowedPaths

`AlwaysAllowedPaths` is a mutable list — add consumer-specific paths at startup without replacing the entire list:

```csharp
builder.Services.AddBieberWorksMaintenance(opts =>
{
    // Auth routes must be reachable so users can log in during maintenance.
    opts.AlwaysAllowedPaths.Add("/bw/auth/");
    opts.AlwaysAllowedPaths.Add("/bw/account/");

    // Health-check endpoint for load-balancer probes.
    opts.AlwaysAllowedPaths.Add("/health");

    // CDN or static file endpoints.
    opts.AlwaysAllowedPaths.Add("/api/cdn/");
});
```

The middleware performs case-insensitive `StartsWith` matching on the request path:
- `/bw/auth/` allows `/bw/auth/login`, `/bw/auth/register`, `/bw/auth/forgot-password`, etc.
- `/health` allows `/health`, `/health/live`, `/health/ready`, etc.

### Using IMaintenancePathProvider

For reusable packages or modules that must contribute allowed paths without touching host configuration, implement `IMaintenancePathProvider`:

```csharp
using BieberWorks.SDK.Maintenance.Contracts;
using Microsoft.Extensions.DependencyInjection;

// Example: Auth module contributor
internal sealed class AuthPathProvider : IMaintenancePathProvider
{
    public IEnumerable<string> GetAllowedPaths()
    {
        return
        [
            "/bw/auth/",
            "/bw/account/login",
            "/bw/account/register"
        ];
    }
}

// Register in your module's AddXxx method:
public static IServiceCollection AddMyModule(this IServiceCollection services)
{
    // ... other setup ...

    services.TryAddEnumerable(
        ServiceDescriptor.Singleton<IMaintenancePathProvider, AuthPathProvider>());

    return services;
}
```

**Key benefits:**
- The module auto-contributes its paths at registration time.
- The host doesn't need to know about or maintain the module's paths.
- Multiple providers are fully additive — all paths merge at runtime.
- The middleware collects all `IMaintenancePathProvider` registrations and merges them with `AlwaysAllowedPaths`.

---

## Bypass mechanisms

Three composable, additive options let requests pass through the middleware even
while maintenance mode is active. They can be combined; the middleware evaluates
them in the order shown in [Architecture](10-architecture.md#middleware-request-processing).

| Mechanism | Scope | Evaluation | Typical use case |
|---|---|---|---|
| `MaintenanceOptions.BypassPredicate` | Host-wide, single rule | Synchronous, `Func<HttpContext, bool>` | Global consumer rule (e.g. custom admin check), evaluated once per request |
| `IMaintenancePathProvider` | Static path prefixes | `IEnumerable<string>`, `StartsWith` match | Modules whitelisting fixed route prefixes (e.g. `/bw/auth/`) without host config |
| `IMaintenanceBypassProvider` | Dynamic, per-request condition | `ValueTask<bool>`, async, OR-combined across all registrations | Requests that depend on content, not just path — e.g. presence of a signature header |

`IMaintenanceBypassProvider` is the right fit when a path prefix alone is not a safe
enough condition — for example, a webhook receiver that must only bypass maintenance
when the expected signature header is present:

```csharp
using BieberWorks.SDK.Maintenance.Contracts;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;

internal sealed class WebhookBypassProvider : IMaintenanceBypassProvider
{
    public ValueTask<bool> ShouldBypassAsync(HttpContext context)
    {
        var isWebhookPath = context.Request.Path.StartsWithSegments("/bw/payments/webhooks");
        var hasSignature = context.Request.Headers.ContainsKey("Stripe-Signature");
        return ValueTask.FromResult(isWebhookPath && hasSignature);
    }
}

// Register in your module's AddXxx method:
services.AddSingleton<IMaintenanceBypassProvider, WebhookBypassProvider>();
```

The middleware short-circuits on the first provider returning `true` — remaining
providers are not invoked for that request. Provider exceptions propagate unchanged
(fail-fast); implementations should not read the request body.

---

## Public Maintenance Page

As of `BieberWorks.SDK.Maintenance.UI.Blazor.MudBlazor` 2.1.0, the module ships its own
public page at `/maintenance` — no consumer setup required. It is anonymous (no
`[Authorize]`), renders under a minimal full-screen `MaintenanceLayout` (no
AppBar/Nav/Drawer, inherits the host's app-wide `BwThemeProvider` theme), and shows the
same logo + Title/Message/Reason/ETA content as the admin preview via the shared
`MaintenanceContentView` component. If maintenance mode is not active, the page
redirects to `/` on first render.

Add the UI assembly to the Blazor router as shown above and the page is available
immediately; no additional Razor component to write.

### Reusing MaintenanceContentView with a custom PagePath

If you set `opts.PagePath` to something other than `/maintenance`, you must provide
your own page at that route — but you can still reuse the display component instead of
re-implementing the logo/text layout:

```razor
@page "/status/maintenance"
@inject IMaintenanceModeService MaintenanceService
@inject IBrandingService BrandingService

@if (_status is not null)
{
    <BieberWorks.SDK.Maintenance.UI.Blazor.MudBlazor.Components.MaintenanceContentView
        Title="@_status.Title"
        Message="@_status.Message"
        Reason="@_status.Reason"
        Eta="@_status.Eta"
        LogoSvg="@_logoSvg"
        LogoUrl="@_logoUrl"
        Dense="false" />
}

@code {
    private MaintenanceStatus? _status;
    private string? _logoSvg;
    private string? _logoUrl;

    protected override async Task OnInitializedAsync()
    {
        _status = await MaintenanceService.GetStatusAsync();

        var logo = await BrandingService.GetLogoSvgAsync();
        _logoSvg = logo?.Markup is { Length: > 0 } svg ? SvgColorPatcher.Patch(svg) : null;

        var assets = await BrandingService.GetDerivedAssetsAsync();
        _logoUrl = assets.Favicon32Url;
    }
}
```

### MaintenanceStatus Fields

The `MaintenanceStatus` record exposes the full state:

```csharp
public sealed record MaintenanceStatus(
    bool IsEnabled,                    // true if maintenance mode is active
    string Title,                      // "Maintenance" (default) or custom
    string Message,                    // "We'll be right back." (default) or custom
    string? Reason,                    // null or free text (e.g., "Database upgrade")
    string? Eta,                       // null or free text (e.g., "approx. 2 hours")
    DateTimeOffset? EnabledAt          // UTC timestamp when enabled, or null
);
```

---

## Admin UI

Navigate to `/admin/maintenance` in the Admin shell to toggle maintenance mode and edit content. The page provides:

- **Toggle switch** to enable/disable maintenance mode
- **Timestamp chip** showing when maintenance was last enabled
- **Content form** with fields: Title, Message, Reason (optional), ETA (optional)
- **Live preview panel** (no server round-trip — bound to in-memory form state)

Each field is saved individually to `ISettingsAdminService`, generating a separate audit entry per change (tracked in SDK-Audit with `SettingChangedEvent`).

---

## Localization

The UI package includes localized strings in `MaintenanceUiResources.resx` (English) and optional culture-specific variants.

### Available Localization Keys

The module uses the following keys (editable via SDK-Localization or `MaintenanceUiResources.resx`):

- `Saved_Success` — Confirmation message shown after content save

### Overriding Localization

To customize strings, either:

1. **Add a culture-specific `.resx` file** in the UI package (e.g., `MaintenanceUiResources.de.resx` for German).
2. **Use SDK-Localization** (if available in your host) to provide DB-level overrides:
   - Navigate to `/admin/localization` and search for `MaintenanceUi:Saved_Success`.
   - Edit the value; it takes precedence over the `.resx` file.

Maintenance-mode status text (Title, Message, Reason, ETA) is **not localized** — it is set by administrators in the Admin UI and displayed as-is. If multi-language status pages are needed, implement that in the consumer's maintenance page component (e.g., by reading the user's culture and formatting the message accordingly).

---

## API Response (During Maintenance)

When maintenance mode is active and an API request is made (detected by `Accept: application/json` header or `/api/` path prefix), the middleware returns:

```http
HTTP/1.1 503 Service Unavailable
Content-Type: application/json

{
  "status": 503,
  "title": "Maintenance",
  "message": "We'll be right back.",
  "reason": null,
  "eta": null
}
```

API clients can detect maintenance and respond gracefully (e.g., show a spinner, disable submit buttons, or redirect to a status page).
