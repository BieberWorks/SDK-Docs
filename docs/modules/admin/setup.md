# Setup

## NuGet References

```xml
<ItemGroup>
    <PackageReference Include="BieberWorks.SDK.Admin.Contracts"           Version="0.*-*" />
    <PackageReference Include="BieberWorks.SDK.Admin"                     Version="0.*-*" />
    <PackageReference Include="BieberWorks.SDK.Admin.UI.Blazor.MudBlazor" Version="0.*-*" />
</ItemGroup>
```

`BieberWorks.SDK.Admin` is the implementation package. It contains `AdminModule`, `AdminDbContext`, `IAdminNavigationService`, and `AddBieberWorksAdmin()`. The skin package (`UI.Blazor.MudBlazor`) contains only layouts, Razor components, and `AddBieberWorksAdminUi()`.

## Prerequisites

1. **SDK-UI** must be registered (`AddBieberWorksUi()`) before the Admin skin is used.
2. A **`DefaultConnection`** connection string must be present in configuration — `AddBieberWorksAdmin()` registers `AdminDbContext` via `AddBieberWorksNpgsql` using it (schema `admin`). Migrations are applied automatically at startup.
3. **SDK-Settings** is optional, but **recommended** for persistence of navigation overrides. Without it, the admin shell functions but order resets on each reload.

## Program.cs

```csharp
using BieberWorks.SDK.Admin.Extensions;
using BieberWorks.SDK.Admin.UI.Blazor.MudBlazor.Extensions;
using BieberWorks.SDK.UI.MudBlazor.Extensions;
using BieberWorks.SDK.Core.Web.Modularity;

// Discovers and registers all IModule implementations (including AdminModule and
// AdminUiMudBlazorModule) from the dependency graph. Call once — covers all modules.
builder.Services.AddBieberWorksModules(builder.Configuration);

// SDK-UI must come before the Admin skin (Admin depends on it).
builder.Services.AddBieberWorksUi();

// Blazor Server with interactive render mode
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();

// ...

var app = builder.Build();

// Apply EF migrations for all IModuleInitializer modules (including AdminDbContext).
await app.InitializeBieberWorksModulesAsync();

// Map Minimal API routes for all IEndpointModule modules.
app.MapBieberWorksModules();

// Auto-discovers all BieberWorks.SDK.*.MudBlazor assemblies including Admin.UI.Blazor.MudBlazor.
app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode()
    .AddBwModuleAssemblies(typeof(Program).Assembly);
```

## Routes.razor

```razor
@using BieberWorks.SDK.Admin.Contracts
@using BieberWorks.SDK.Admin.UI.Blazor.MudBlazor.Layout
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

`AdminModule` (in `BieberWorks.SDK.Admin`) implements `IModule`, `IEndpointModule`, and `IModuleInitializer`. When you call `builder.Services.AddBieberWorksModules(builder.Configuration)`, `AdminModule` is discovered automatically and calls `AddBieberWorksAdmin(configuration)` internally, including `AdminDbContext` registration and migration.

`AdminUiMudBlazorModule` (in `BieberWorks.SDK.Admin.UI.Blazor.MudBlazor`) is also discovered automatically and calls `AddBieberWorksAdminUi()` (MudBlazor services only).

If you prefer explicit registration instead of `AddBieberWorksModules`, call both manually:

```csharp
// Impl: DbContext, navigation service, permission contributor
services.AddBieberWorksAdmin(builder.Configuration);

// Skin: MudBlazor services
services.AddBieberWorksAdminUi();
```

## AdminDbContext and Migrations

`AdminDbContext` uses schema `"admin"` and is registered by `AddBieberWorksAdmin()` via `AddBieberWorksNpgsql`. Migrations are applied idempotently at startup via `InitializeBieberWorksModulesAsync()`. No manual migration steps are required after deployment.

## Permission `admin:shell:access`

The admin shell is protected by `admin:shell:access` permission. It is automatically registered by `BieberWorks.SDK.Admin` (via `AdminPermissionContributor`). Users need this permission to:

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

See `Admin.UI.Blazor.MudBlazor/Resources/AdminResources.resx` for complete translations.
