# SDK-Admin — Setup

## NuGet-Pakete

```xml
<PackageReference Include="BieberWorks.SDK.Admin.Contracts"      Version="0.*-*" />
<PackageReference Include="BieberWorks.SDK.Admin.UI.MudBlazor"   Version="0.*-*" />
```

::: tip Contracts only
Fachmodule, die nur `IAdminSection` implementieren, brauchen ausschließlich `BieberWorks.SDK.Admin.Contracts`. `BieberWorks.SDK.Admin.UI.MudBlazor` wird nur vom Host referenziert.
:::

## Voraussetzungen

SDK-Admin setzt SDK-UI voraus. Stelle sicher, dass `AddBieberWorksUi()` vor `AddBieberWorksAdmin()` aufgerufen wird.

```xml
<!-- Auch im Host -->
<PackageReference Include="BieberWorks.SDK.UI.MudBlazor" Version="0.*-*" />
```

## Program.cs

```csharp
using BieberWorks.SDK.Admin.UI.MudBlazor.Extensions;
using BieberWorks.SDK.UI.MudBlazor.Extensions;

// Reihenfolge wichtig: UI zuerst
builder.Services.AddBieberWorksUi();
builder.Services.AddBieberWorksAdmin();

// Razor Components: Assembly der Admin-UI einbinden
builder.Services
    .AddRazorComponents()
    .AddInteractiveServerComponents()
    .AddAdditionalAssemblies(
        typeof(BieberWorks.SDK.Admin.UI.MudBlazor.AdminModule).Assembly,
        typeof(BieberWorks.SDK.UI.MudBlazor.Components.BwThemeProvider).Assembly
    );
```

`AddBieberWorksAdmin()` registriert:

| Service | Lifetime | Beschreibung |
|---|---|---|
| MudBlazor Services | — | via `AddMudServices()` |
| `IPermissionContributor` → `AdminPermissionContributor` | Singleton | Meldet `admin:shell:access` beim Auth-Permissions-System an |

## Routes.razor

```razor
@* Routes.razor *@
<BwThemeProvider>
    <Router AppAssembly="@typeof(App).Assembly"
            AdditionalAssemblies="@_moduleAssemblies">
        <Found Context="routeData">
            <RouteView RouteData="@routeData" DefaultLayout="@typeof(MainLayout)" />
            <FocusOnNavigate RouteData="@routeData" Selector="h1" />
        </Found>
    </Router>
</BwThemeProvider>

@code {
    private static readonly Assembly[] _moduleAssemblies =
    [
        typeof(BieberWorks.SDK.Admin.UI.MudBlazor.AdminModule).Assembly,
        typeof(BieberWorks.SDK.UI.MudBlazor.Components.BwThemeProvider).Assembly,
        // weitere Module...
    ];
}
```

::: warning BwThemeProvider
`BwThemeProvider` muss in `Routes.razor` stehen, nicht innerhalb von `AdminLayout`. Siehe [SDK-UI Setup](../ui/setup.md).
:::

## IModule-basierter Ansatz (alternativ)

Wenn der Host `AddBieberWorksModules()` aus `SDK-Foundation` nutzt, registriert sich `AdminModule` automatisch:

```csharp
// Program.cs
builder.Services.AddBieberWorksModules(builder.Configuration);

// app setup
app.MapBieberWorksModules();
await app.InitializeBieberWorksModulesAsync();
```

`AdminModule` implementiert `IModule` und `IEndpointModule` (ohne eigene Endpoints) und ruft intern `AddBieberWorksAdmin()` auf.

## Permission: admin:shell:access

Der Zugang zur Admin-Shell wird durch die Policy `perm:admin:shell:access` geschützt (`AdminPermissions.ShellAccess = "admin:shell:access"`). `AdminPermissionContributor` meldet diesen Schlüssel beim Auth-Modul an. Stelle sicher, dass die Admin-Rolle diese Permission besitzt.
