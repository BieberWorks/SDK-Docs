# Setup

## NuGet References

```xml
<ItemGroup>
    <PackageReference Include="BieberWorks.SDK.Admin.Contracts" Version="0.*-*" />
    <PackageReference Include="BieberWorks.SDK.Admin.UI.MudBlazor" Version="0.*-*" />
</ItemGroup>
```

## Prerequisites

1. **SDK-UI** must be registered (required by Admin.UI.MudBlazor).
2. **SDK-Settings** is optional, but **recommended** for persistence of navigation structure. Without settings, the admin shell functions (order resets on each reload).

## Program.cs

```csharp
// 1. SDK-Core (if not already registered)
services.AddBieberWorksCore();

// 2. SDK-UI (prerequisite)
services.AddBieberWorksUi();

// 3. SDK-Settings (optional)
services.AddBieberWorksSettings();

// 4. SDK-Admin
services.AddBieberWorksAdmin();

// 5. MudBlazor services (already included in AddBieberWorksAdmin)

// 6. Auth module (if permissions are needed)
services.AddBieberWorksAuth();

// ASP.NET Core Razor Components
var builder = services
    .AddRazorComponents()
    .AddInteractiveServerComponents();

// Additional assemblies (UI modules must be registered here)
builder.AddAdditionalAssemblies(
    typeof(BieberWorks.SDK.Admin.UI.MudBlazor.AdminModule).Assembly
    // ... additional *.UI.MudBlazor assemblies
);
```

## Routes.razor

```razor
@using Microsoft.AspNetCore.Components.Routing

<Router AppAssembly="@typeof(Program).Assembly"
        AdditionalAssemblies="new[] { typeof(BieberWorks.SDK.Admin.UI.MudBlazor.AdminModule).Assembly }">
    <Found Context="routeData">
        <RouteView RouteData="@routeData" DefaultLayout="@typeof(BwShellLayout)" />
    </Found>
    <NotFound>
        <PageTitle>Not found</PageTitle>
        <BwShellLayout>
            <MudAlert Severity="Severity.Error">Page not found</MudAlert>
        </BwShellLayout>
    </NotFound>
</Router>
```

## Alternative: IModule-based

If the host uses the BieberWorks.SDK.Core module system:

```csharp
public class MyModule : IModule
{
    public string Name => "MyModule";
    
    public IServiceCollection RegisterServices(IServiceCollection services, IConfiguration config)
    {
        services.AddBieberWorksAdmin();
        // ... additional services
        return services;
    }
}
```

## Permission `admin:shell:access`

The admin shell is protected by `admin:shell:access` permission. It is automatically registered by SDK-Admin (via `AdminPermissionContributor`). Users need this permission to:

- Enter the admin area
- Enable edit mode

## Localization Strings

The module uses `.resx` resources for localization (English/German). Standard strings are:

- `Layout_AppBarTitle` — App bar title
- `Layout_BackToApp` — Back button
- `Layout_DrawerNavTitle` — Drawer header
- `Layout_EditMode_Enter` — "Enable edit mode"
- `Layout_EditMode_Exit` — "Disable edit mode"
- `Nav_AddFolder` — "Add folder"
- `Nav_RenameFolder` — "Rename folder"
- `Nav_DeleteFolder` — "Delete folder"
- `Nav_DeleteFolderConfirm` — Confirmation text
- `Nav_FolderNamePlaceholder` — Input placeholder
- `Nav_MoveOut` — "Move out of folder"

See `Admin.UI.MudBlazor/Resources/AdminResources.resx` for complete translations.
