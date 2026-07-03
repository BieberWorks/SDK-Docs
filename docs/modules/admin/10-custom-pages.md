# Custom Admin Pages

## Implement IAdminSection

Each domain module offers one or more admin pages through `IAdminSection` — an empty marker
interface (in `Admin.Contracts`) over `BieberWorks.SDK.Shell.Contracts.IShellSection`, the
generic navigation kernel provided by the **SDK-Shell** module:

```csharp
using BieberWorks.SDK.Admin.Contracts;
using BieberWorks.SDK.Shell.Contracts;

namespace MyModule;

public class MyAdminSection : IAdminSection
{
    // Stable lower-kebab-case key — must be unique across all modules.
    public string Key   => "my-module";
    public string Title => "My Module";
    public string Icon  => Icons.Material.Filled.Settings;
    public int    Order => 100;

    public IReadOnlyList<ShellNavItem> NavItems =>
    [
        new ShellNavItem
        {
            Title = "Overview",
            Href = "/admin/mymodule",
            Icon = Icons.Material.Filled.Dashboard
        },
        new ShellNavItem
        {
            Title = "Settings",
            Href = "/admin/mymodule/settings",
            Icon = Icons.Material.Filled.Tune
        }
    ];
    
    public bool IsEnabled(IServiceProvider services)
    {
        // Optional: check feature flag or permission
        return true;
    }
}
```

### ShellNavItem

An init-record with three required properties:

- **`Title`** — Link label
- **`Href`** — Route (e.g., `/admin/dashboard`, `/admin/users`)
- **`Icon`** — MudBlazor icon

```csharp
new ShellNavItem { Title = "Users", Href = "/admin/users", Icon = Icons.Material.Filled.Person }
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
