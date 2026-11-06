# Setup

## NuGet packages

```xml
<PackageReference Include="BieberWorks.SDK.UI.Contracts" Version="0.*-*" />
<PackageReference Include="BieberWorks.SDK.UI.Blazor.MudBlazor"  Version="0.*-*" />
```

::: tip Domain modules
Domain modules that only implement `IAppBarWidget` need only `BieberWorks.SDK.UI.Contracts`.
:::

## Program.cs

```csharp
using BieberWorks.SDK.UI.Blazor.MudBlazor.Extensions;

// Register services
builder.Services.AddBieberWorksUi();
```

`AddBieberWorksUi()` registers:

| Service | Lifetime | Description |
|---|---|---|
| `IThemeService` → `ThemeService` | Scoped | Dark mode state and toggle |
| `ICookieConsentService` → `CookieConsentService` | Scoped | Cookie consent management |
| `ILayoutThemeProvider` → `DefaultLayoutThemeProvider` | Scoped | Provides `LayoutThemeData` per layout key; registered via `TryAddScoped` — can be overridden by SDK-Theme |
| `ILayoutThemeContext` → `LayoutThemeContext` | Scoped | Holds current layout key and fires `OnChanged` on switch |
| `IUserTimeZoneAccessor` → `UserTimeZoneAccessor` | Scoped | UTC/Local display mode, browser timezone detection via JS, `bw.tz` cookie persistence |
| `ICookieRegistrationSource` → `TimeZoneCookieRegistrationSource` | Singleton (enumerable) | Registers the `bw.tz` cookie as a `Necessary` cookie in the consent subsystem |

## Routes.razor

`BwThemeProvider` must exist **exactly once** in the component tree, best in `Routes.razor`. Use `BwRouter` (namespace `BieberWorks.SDK.UI.Blazor.MudBlazor.Routing`) instead of the plain `Router`:

```razor
@* Routes.razor *@
@using BieberWorks.SDK.UI.Blazor.MudBlazor.Routing

<BwThemeProvider>
    <BwRouter AppAssembly="typeof(App).Assembly">
        <Found Context="routeData">
            <RouteView RouteData="@routeData" DefaultLayout="@typeof(MainLayout)" />
            <FocusOnNavigate RouteData="@routeData" Selector="h1" />
        </Found>
    </BwRouter>
</BwThemeProvider>
```

::: warning Uniqueness rule
`BwThemeProvider` must not be placed in individual layouts — it would be re-instantiated on every layout change and reset theme state. Only correct location: `Routes.razor` (or equivalent root component above the router).
:::

### Module assemblies

`BwRouter` and `AddBwModuleAssemblies` discover all `BieberWorks.SDK.*` UI assemblies automatically; no assembly list is maintained in `Routes.razor` or `Program.cs`:

```csharp
// Program.cs
app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode()
    .AddBwModuleAssemblies(typeof(Program).Assembly);
```

For host-owned modules with a different prefix (e.g. `MyApp.Modules.Events.UI.Blazor.MudBlazor`) pass the prefix on both sides (server: Foundation 2.3.2+, client: SDK-UI 1.3.2+):

```csharp
.AddBwModuleAssemblies(typeof(Program).Assembly, additionalUiPrefixes: ["MyApp.Modules"]);
```

```razor
<BwRouter AppAssembly="typeof(App).Assembly" AdditionalUiPrefixes="@(["MyApp.Modules"])">
```

`ModuleAssemblies` on `BwRouter` is a full manual override (the additional parameters are then ignored). See [Components — BwRouter](50-components.md).
