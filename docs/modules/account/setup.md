# SDK-Account — Setup

## NuGet-Pakete

```xml
<PackageReference Include="BieberWorks.SDK.Account.Contracts"    Version="0.*-*" />
<PackageReference Include="BieberWorks.SDK.Account.UI.MudBlazor" Version="0.*-*" />
```

::: tip Contracts only
Fachmodule, die nur `IAccountSection` implementieren, brauchen ausschließlich `BieberWorks.SDK.Account.Contracts`. `BieberWorks.SDK.Account.UI.MudBlazor` wird nur vom Host referenziert.
:::

## Voraussetzungen

SDK-Account setzt SDK-UI voraus. Stelle sicher, dass `AddBieberWorksUi()` vor `AddBieberWorksAccount()` aufgerufen wird.

```xml
<!-- Auch im Host -->
<PackageReference Include="BieberWorks.SDK.UI.MudBlazor" Version="0.*-*" />
```

## Program.cs

```csharp
using BieberWorks.SDK.Account.UI.MudBlazor.Extensions;
using BieberWorks.SDK.UI.MudBlazor.Extensions;

// Reihenfolge wichtig: UI zuerst
builder.Services.AddBieberWorksUi();
builder.Services.AddBieberWorksAccount();

// Razor Components: Assembly der Account-UI einbinden
builder.Services
    .AddRazorComponents()
    .AddInteractiveServerComponents()
    .AddAdditionalAssemblies(
        typeof(BieberWorks.SDK.Account.UI.MudBlazor.AccountModule).Assembly,
        typeof(BieberWorks.SDK.UI.MudBlazor.Components.BwThemeProvider).Assembly
    );
```

`AddBieberWorksAccount()` registriert:

| Service | Lifetime | Beschreibung |
|---|---|---|
| MudBlazor Services | — | via `AddMudServices()` |

Die `IAccountSection`-Sammlung wird nicht durch `AddBieberWorksAccount()` befüllt — das übernehmen die einzelnen Fachmodule, die ihre Sektionen via `services.AddSingleton<IAccountSection, MySection>()` eintragen.

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
        // weitere Module...
    ];
}
```

::: warning BwThemeProvider
`BwThemeProvider` muss in `Routes.razor` stehen, nicht innerhalb von `AccountLayout`. Siehe [SDK-UI Setup](../ui/setup.md).
:::

## IModule-basierter Ansatz (alternativ)

```csharp
// Program.cs
builder.Services.AddBieberWorksModules(builder.Configuration);

app.MapBieberWorksModules();
await app.InitializeBieberWorksModulesAsync();
```

`AccountModule` implementiert `IModule` und `IEndpointModule` (ohne eigene Endpoints) und ruft intern `AddBieberWorksAccount()` auf.
