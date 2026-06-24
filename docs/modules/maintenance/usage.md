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
| `AlwaysAllowedPaths` | `string[]` | `/admin`, `/health`, `/favicon.ico`, `/_blazor`, `/_framework`, `/maintenance` | Path prefixes that always bypass the middleware. Preserve `/_blazor` and `/_framework` when overriding. |
| `BypassPredicate` | `Func<HttpContext, bool>?` | `null` | Consumer bypass predicate — runs before `IsEnabledAsync` to avoid a Settings round-trip |

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
