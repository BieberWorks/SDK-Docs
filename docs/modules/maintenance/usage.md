# SDK-Maintenance — Usage Guide

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

**Middleware placement — must come before `UseRouting` and `UseAuthentication`:**

```csharp
app.UseMaintenanceMode();     // <-- early in the pipeline
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
// ... rest of pipeline
```

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

## Consumer Maintenance Page

The SDK does not ship a maintenance page — consumers own the design. The `/maintenance` path receives a redirect, but you must implement the actual Razor component:

```csharp
@page "/maintenance"
@inject IMaintenanceModeService MaintenanceService

<div class="maintenance-container">
    @if (_status?.IsEnabled == true)
    {
        <h1>@_status.Title</h1>
        <p>@_status.Message</p>

        @if (!string.IsNullOrEmpty(_status.Reason))
        {
            <p><strong>Reason:</strong> @_status.Reason</p>
        }

        @if (!string.IsNullOrEmpty(_status.Eta))
        {
            <p><strong>ETA:</strong> @_status.Eta</p>
        }

        @if (_status.EnabledAt.HasValue)
        {
            <p><em>Maintenance started: @_status.EnabledAt:g</em></p>
        }
    }
    else
    {
        <p>Maintenance mode is not active.</p>
    }
</div>

@code {
    private MaintenanceStatus? _status;

    protected override async Task OnInitializedAsync()
    {
        _status = await MaintenanceService.GetStatusAsync();
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
