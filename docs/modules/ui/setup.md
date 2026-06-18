# SDK-UI — Setup

## NuGet packages

```xml
<PackageReference Include="BieberWorks.SDK.UI.Contracts" Version="0.*-*" />
<PackageReference Include="BieberWorks.SDK.UI.MudBlazor"  Version="0.*-*" />
```

::: tip Domain modules
Domain modules that only implement `IAppBarWidget` need only `BieberWorks.SDK.UI.Contracts`.
:::

## Program.cs

```csharp
using BieberWorks.SDK.UI.MudBlazor.Extensions;

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

## Routes.razor

`BwThemeProvider` must exist **exactly once** in the component tree, best in `Routes.razor`:

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
```

::: warning Uniqueness rule
`BwThemeProvider` must not be placed in individual layouts — it would be re-instantiated on every layout change and reset theme state. Only correct location: `Routes.razor` (or equivalent root component above the router).
:::

### AdditionalAssemblies

For the Blazor router to find pages from `BieberWorks.SDK.UI.MudBlazor` (e.g. future UI pages), the assembly must be registered:

```csharp
// Program.cs
builder.Services
    .AddRazorComponents()
    .AddInteractiveServerComponents()
    .AddAdditionalAssemblies(
        typeof(BieberWorks.SDK.UI.MudBlazor.Components.BwThemeProvider).Assembly
        // other module assemblies...
    );
```

And in the router:

```razor
@code {
    private static readonly Assembly[] _moduleAssemblies =
    [
        typeof(BieberWorks.SDK.UI.MudBlazor.Components.BwThemeProvider).Assembly,
        // others...
    ];
}
```
