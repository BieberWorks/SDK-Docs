# Custom Admin Pages

## Implement IAdminSection

Each domain module offers one or more admin pages through `IAdminSection`:

```csharp
using BieberWorks.SDK.Admin.Contracts;

namespace MyModule;

public class MyAdminSection : IAdminSection
{
    public string Title => "My Module";
    
    public string Icon => Icons.Material.Filled.Settings;
    
    public int Order => 100;
    
    public IReadOnlyList<AdminNavItem> NavItems => new[]
    {
        new AdminNavItem(
            Title: "Overview",
            Href: "/admin/mymodule",
            Icon: Icons.Material.Filled.Dashboard
        ),
        new AdminNavItem(
            Title: "Settings",
            Href: "/admin/mymodule/settings",
            Icon: Icons.Material.Filled.Tune
        )
    };
    
    public bool IsEnabled(IServiceProvider services)
    {
        // Optional: check feature flag or permission
        return true;
    }
}
```

### AdminNavItem

A record with three properties:

- **`Title`** — Link label
- **`Href`** — Route (e.g., `/admin/dashboard`, `/admin/users`)
- **`Icon`** — MudBlazor icon

```csharp
new AdminNavItem("Users", "/admin/users", Icons.Material.Filled.Person)
```

## DI Registration

In the module's `ServiceCollectionExtensions`:

```csharp
public static IServiceCollection AddMyModule(this IServiceCollection services, IConfiguration config)
{
    // ... other services
    services.AddSingleton<IAdminSection, MyAdminSection>();
    return services;
}
```

The host calls `AddMyModule()` — the admin shell automatically recognizes all registered `IAdminSection` instances.

## Create Admin Page

Each route in `NavItems.Href` needs a corresponding `.razor` page:

```razor
@* /Admin/MyModule.razor *@

@using BieberWorks.SDK.Admin
@implements IAdminPage
@layout AdminLayout

@page "/admin/mymodule"
@page "/admin/mymodule/settings"

@attribute [Authorize(Policy = "perm:admin:shell:access")]

<PageTitle>My Module</PageTitle>

<MudContainer>
    <MudText Typo="Typo.h4" Class="mb-4">Module Settings</MudText>
    
    <!-- Page content -->
    <MudCard>
        <MudCardContent>
            <MudText>Users can make settings here.</MudText>
        </MudCardContent>
    </MudCard>
</MudContainer>
```

### Required Attributes

- **`@layout AdminLayout`** — uses admin layout (drawer + app bar)
- **`@implements IAdminPage`** — marker interface, not currently functional, but clarifies intent
- **`@page`** — must match routes from `NavItems.Href`
- **`@attribute [Authorize(...)]`** — optional, but **recommended** for permission protection

## Feature-Flag-Controlled Sections

Via `IsEnabled`:

```csharp
public bool IsEnabled(IServiceProvider services)
{
    var settingsService = services.GetService<ISettingsService>();
    if (settingsService is null) return true;
    
    var enabled = settingsService.GetValue("features:audit-enabled");
    return enabled != "false";
}
```

The module is shown only if the feature is active.

## Structure in Host

```
Host/
├── Pages/
│   └── Admin/
│       ├── MyModule.razor           ← Page for "/admin/mymodule"
│       ├── Settings.razor           ← Page for "/admin/mymodule/settings"
│       └── ...
├── Program.cs                       ← Call AddMyModule()
└── ...
```

Razor pages can reside in the host or in a separate RCL (Razor Class Library, e.g., `MyModule.UI.MudBlazor.dll`).
