# SDK-Account — Setup

## NuGet packages

```xml
<PackageReference Include="BieberWorks.SDK.Account.Contracts"    Version="0.*-*" />
<PackageReference Include="BieberWorks.SDK.Account.UI.MudBlazor" Version="0.*-*" />
```

::: tip Contracts only
Domain modules that only implement `IAccountSection` need only `BieberWorks.SDK.Account.Contracts`. `BieberWorks.SDK.Account.UI.MudBlazor` is referenced only by the host.
:::

## Prerequisites

SDK-Account requires SDK-UI. Ensure `AddBieberWorksUi()` is called before `AddBieberWorksAccount()`.

```xml
<!-- Also in the host -->
<PackageReference Include="BieberWorks.SDK.UI.MudBlazor" Version="0.*-*" />
```

## Program.cs

```csharp
using BieberWorks.SDK.Account.UI.MudBlazor.Extensions;
using BieberWorks.SDK.UI.MudBlazor.Extensions;

// Order matters: UI first
builder.Services.AddBieberWorksUi();
builder.Services.AddBieberWorksAccount();

// Razor components: register account UI assembly
builder.Services
    .AddRazorComponents()
    .AddInteractiveServerComponents()
    .AddAdditionalAssemblies(
        typeof(BieberWorks.SDK.Account.UI.MudBlazor.AccountModule).Assembly,
        typeof(BieberWorks.SDK.UI.MudBlazor.Components.BwThemeProvider).Assembly
    );
```

`AddBieberWorksAccount()` registers:

| Service | Lifetime | Description |
|---|---|---|
| MudBlazor services | — | via `AddMudServices()` |

The `IAccountSection` collection is not populated by `AddBieberWorksAccount()` — domain modules do that by registering their sections via `services.AddSingleton<IAccountSection, MySection>()`.

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
        typeof(BieberWorks.SDK.Account.UI.MudBlazor.AccountModule).Assembly,
        typeof(BieberWorks.SDK.UI.MudBlazor.Components.BwThemeProvider).Assembly,
        // other modules...
    ];
}
```

::: warning BwThemeProvider
`BwThemeProvider` must be in `Routes.razor`, not inside `AccountLayout`. See [SDK-UI Setup](../ui/setup.md).
:::

## IModule-based approach (alternative)

```csharp
// Program.cs
builder.Services.AddBieberWorksModules(builder.Configuration);

app.MapBieberWorksModules();
await app.InitializeBieberWorksModulesAsync();
```

`AccountModule` implements `IModule` and `IEndpointModule` (without own endpoints) and calls `AddBieberWorksAccount()` internally.
