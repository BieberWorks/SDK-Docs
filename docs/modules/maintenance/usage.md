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
        opts.BypassPredicate = ctx => ctx.User.IsInRole("Admin");
    })
    .AddBieberWorksMaintenanceUi();     // only when Admin shell is present
```

**Middleware placement — must come before `UseRouting` and `UseAuthentication`:**

```csharp
app.UseMaintenanceMode();     // <-- before routing
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
| `PagePath` | `string` | `/maintenance` | Redirect target for browser requests during maintenance |
| `AlwaysAllowedPaths` | `IList<string>` | `/_blazor`, `/_framework`, `/favicon.ico` | Path prefixes that always bypass the middleware. Add entries at startup. Preserve `/_blazor` and `/_framework` when replacing the list. |
| `BypassPredicate` | `Func<HttpContext, bool>` | Admin role check | Consumer bypass predicate — runs before `IsEnabledAsync` to avoid a Settings round-trip |

---

## Allowed Paths

`AlwaysAllowedPaths` is a mutable list — consumers can add paths at startup without replacing the entire list:

```csharp
builder.Services.AddBieberWorksMaintenance(opts =>
{
    // Auth routes must be reachable so users can log in during maintenance.
    opts.AlwaysAllowedPaths.Add("/bw/auth/");
    opts.AlwaysAllowedPaths.Add("/bw/account/login");

    // Health-check endpoint for load-balancer probes.
    opts.AlwaysAllowedPaths.Add("/health");
});
```

The middleware performs a case-insensitive `StartsWith` match, so `/bw/auth/` allows `/bw/auth/login`, `/bw/auth/register`, etc.

---

## Extending Path Providers

`IMaintenancePathProvider` (in `BieberWorks.SDK.Maintenance.Contracts`) is a DI-based extension point for packages or modules that need to contribute allowed paths without touching `MaintenanceOptions`:

```csharp
using BieberWorks.SDK.Maintenance.Contracts;

internal sealed class AuthPathProvider : IMaintenancePathProvider
{
    public IEnumerable<string> GetAllowedPaths()
        => ["/bw/auth/", "/bw/account/login"];
}

// In your module's AddXxx extension method:
services.TryAddEnumerable(
    ServiceDescriptor.Singleton<IMaintenancePathProvider, AuthPathProvider>());
```

Multiple providers are fully additive — each registration contributes its paths on top of others. The middleware merges all provider paths with `AlwaysAllowedPaths` at request time.

---

## Consumer Maintenance Page

The SDK deliberately does not ship a maintenance page — consumers own the design. Inject `IMaintenanceModeService` and call `GetStatusAsync()` to read the current state:

```csharp
@page "/maintenance"
@inject IMaintenanceModeService MaintenanceService

@code {
    private MaintenanceStatus? _status;

    protected override async Task OnInitializedAsync()
        => _status = await MaintenanceService.GetStatusAsync();
}
```

Render `_status.Title`, `_status.Message`, `_status.Reason`, and `_status.Eta` as needed in your layout.

---

## Admin UI

Navigate to `/admin/maintenance` in the Admin shell to toggle maintenance mode and edit content. The page provides:

- Toggle switch to enable/disable maintenance mode
- Timestamp chip showing when maintenance was last enabled
- Content form: Title, Message, Reason (optional), ETA (optional)
- Live preview panel (no server round-trip — bound to in-memory form state)

Each field is saved individually to `ISettingsAdminService`, generating a separate audit entry per change.
