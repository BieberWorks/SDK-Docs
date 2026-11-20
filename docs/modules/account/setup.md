# SDK-Account — Setup

## NuGet packages

```xml
<PackageReference Include="BieberWorks.SDK.Account.Contracts"           Version="0.*-*" />
<PackageReference Include="BieberWorks.SDK.Account"                     Version="0.*-*" />
<PackageReference Include="BieberWorks.SDK.Account.UI.Blazor.MudBlazor" Version="0.*-*" />
```

::: tip Contracts only
Domain modules that only implement `IAccountSection` need only `BieberWorks.SDK.Account.Contracts`. `BieberWorks.SDK.Account` and `BieberWorks.SDK.Account.UI.Blazor.MudBlazor` are referenced only by the host.
:::

`BieberWorks.SDK.Account` is the implementation package. It contains `AccountModule`, `AccountDbContext`, `IAccountNavigationService`, and `AddBieberWorksAccount()`. The skin package (`UI.Blazor.MudBlazor`) contains only layouts, Razor components, and `AddBieberWorksAccountUi()`.

## Prerequisites

1. **SDK-UI** must be registered (`AddBieberWorksUi()`) before the Account skin is used.
2. A **`DefaultConnection`** connection string must be present in configuration — `AddBieberWorksAccount()` registers `AccountDbContext` via `AddBieberWorksNpgsql` using it (schema `account`). Migrations are applied automatically at startup.

```xml
<!-- Also in the host -->
<PackageReference Include="BieberWorks.SDK.UI.Blazor.MudBlazor" Version="2.*-*" />
```

## Program.cs

```csharp
using BieberWorks.SDK.Account.Extensions;
using BieberWorks.SDK.Account.UI.Blazor.MudBlazor.Extensions;
using BieberWorks.SDK.UI.MudBlazor.Extensions;
using BieberWorks.SDK.Core.Web.Modularity;

// Discovers and registers all IModule implementations (including AccountModule and
// AccountUiMudBlazorModule) from the dependency graph. Call once — covers all modules.
builder.Services.AddBieberWorksModules(builder.Configuration);

// SDK-UI must come before the Account skin (Account depends on it).
builder.Services.AddBieberWorksUi();

// Razor components: register account UI assembly
builder.Services
    .AddRazorComponents()
    .AddInteractiveServerComponents()
    .AddAdditionalAssemblies(
        typeof(BieberWorks.SDK.Account.UI.Blazor.MudBlazor.AccountUiMudBlazorModule).Assembly,
        typeof(BieberWorks.SDK.UI.MudBlazor.Components.BwThemeProvider).Assembly
    );
```

When using `AddBieberWorksModules`, `AccountModule` is discovered automatically and calls `AddBieberWorksAccount(configuration)` internally, including `AccountDbContext` registration and migration.

`AddBieberWorksAccount()` registers:

| Service | Lifetime | Description |
|---|---|---|
| `AccountDbContext` | — | via `AddBieberWorksNpgsql` (schema `"account"`, `DefaultConnection`) |
| `IAccountNavigationService` | Scoped | Resolves the final nav tree with overrides applied |
| `INavOverrideTarget` | Scoped | Exposes the account shell to the Admin navigation editor |

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
        typeof(BieberWorks.SDK.Account.UI.Blazor.MudBlazor.AccountUiMudBlazorModule).Assembly,
        typeof(BieberWorks.SDK.UI.MudBlazor.Components.BwThemeProvider).Assembly,
        // other modules...
    ];
}
```

::: warning BwThemeProvider
`BwThemeProvider` must be in `Routes.razor`, not inside `AccountLayout`. See [SDK-UI Setup](../ui/setup.md).
:::

## AccountDbContext and Migrations

`AccountDbContext` uses schema `"account"` and is registered by `AddBieberWorksAccount()` via `AddBieberWorksNpgsql`. Migrations are applied idempotently at startup via `InitializeBieberWorksModulesAsync()`. No manual migration steps are required after deployment.

## IModule-based approach (alternative explicit registration)

```csharp
// Impl: DbContext, navigation service
services.AddBieberWorksAccount(builder.Configuration);

// Skin: MudBlazor services
services.AddBieberWorksAccountUi();

app.MapBieberWorksModules();
await app.InitializeBieberWorksModulesAsync();
```

`AccountModule` (in `BieberWorks.SDK.Account`) implements `IModule`, `IEndpointModule`, and `IModuleInitializer` and calls `AddBieberWorksAccount(configuration)` internally.
