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
using BieberWorks.SDK.Admin.UI.MudBlazor.Extensions;
using BieberWorks.SDK.UI.MudBlazor.Extensions;
using BieberWorks.SDK.Core.Web.Modularity;

// Discovers and registers all IModule implementations (including AdminModule)
// from the dependency graph. Call once — covers all modules.
builder.Services.AddBieberWorksModules(builder.Configuration);

// SDK-UI must come before SDK-Admin (Admin depends on it)
builder.Services.AddBieberWorksUi();

// SDK-Admin shell registration
builder.Services.AddBieberWorksAdmin();

// Blazor Server with interactive render mode
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();

// ...

var app = builder.Build();

// Apply EF migrations for all IModuleInitializer modules
await app.InitializeBieberWorksModulesAsync();

// Map Minimal API routes for all IEndpointModule modules (including Admin REST endpoints)
app.MapBieberWorksModules();

// Auto-discovers all BieberWorks.SDK.*.MudBlazor assemblies including Admin.UI.MudBlazor
app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode()
    .AddBwModuleAssemblies(typeof(Program).Assembly);
```

## Routes.razor

```razor
@using BieberWorks.SDK.Admin.Contracts
@using BieberWorks.SDK.Admin.UI.MudBlazor.Layout
@using BieberWorks.SDK.UI.MudBlazor.Components
@using BieberWorks.SDK.UI.MudBlazor.Routing

<BwThemeProvider>
<BwRouter AppAssembly="typeof(App).Assembly">
    <Found Context="routeData">
        <RouteView RouteData="@routeData"
                   DefaultLayout="@(typeof(IAdminPage).IsAssignableFrom(routeData.PageType)
                                     ? typeof(AdminLayout)
                                     : typeof(MainLayout))" />
        <FocusOnNavigate RouteData="@routeData" Selector="h1" />
    </Found>
</BwRouter>
</BwThemeProvider>
```

::: warning BwThemeProvider is mandatory
`BwThemeProvider` must wrap the router as the outermost element. It must appear exactly once in `Routes.razor` — never inside a layout. Without it, `AdminLayout` and `BwShellLayout` cannot apply theming.
:::

## IModule-based Approach

`AdminModule` already implements `IModule`. When you call `builder.Services.AddBieberWorksModules(builder.Configuration)`, `AdminModule` is discovered automatically and calls `AddBieberWorksAdmin()` internally.

If you want to call `AddBieberWorksAdmin()` explicitly in your own module (e.g. to ensure ordering), you can do so inside your module's `RegisterServices`:

```csharp
public IServiceCollection RegisterServices(IServiceCollection services, IConfiguration config)
{
    services.AddBieberWorksUi();
    services.AddBieberWorksAdmin();
    // ... additional module services
    return services;
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
