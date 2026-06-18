# SDK-UI — Setup

## NuGet-Pakete

```xml
<PackageReference Include="BieberWorks.SDK.UI.Contracts" Version="0.*-*" />
<PackageReference Include="BieberWorks.SDK.UI.MudBlazor"  Version="0.*-*" />
```

::: tip Fachmodule
Fachmodule, die nur `IAppBarWidget` implementieren, brauchen ausschließlich `BieberWorks.SDK.UI.Contracts`.
:::

## Program.cs

```csharp
using BieberWorks.SDK.UI.MudBlazor.Extensions;

// Services registrieren
builder.Services.AddBieberWorksUi();
```

`AddBieberWorksUi()` registriert:

| Service | Lifetime | Beschreibung |
|---|---|---|
| `IThemeService` → `ThemeService` | Scoped | Dark-Mode-Zustand und Toggle |
| `ICookieConsentService` → `CookieConsentService` | Scoped | Cookie-Consent-Verwaltung |
| `ILayoutThemeProvider` → `DefaultLayoutThemeProvider` | Scoped | Liefert `LayoutThemeData` je Layout-Key; wird via `TryAddScoped` registriert — kann durch SDK-Theme überschrieben werden |
| `ILayoutThemeContext` → `LayoutThemeContext` | Scoped | Trägt den aktuellen Layout-Key und feuert `OnChanged` bei Wechsel |

## Routes.razor

`BwThemeProvider` muss **genau einmal** im Komponentenbaum existieren, am besten in `Routes.razor`:

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

::: warning Einmaligkeitsregel
`BwThemeProvider` darf nicht in einzelnen Layouts platziert werden — er würde dann bei jedem Layout-Wechsel neu instanziiert und den Theme-Zustand zurücksetzen. Einzig korrekter Ort: `Routes.razor` (oder eine äquivalente Root-Komponente oberhalb des Routers).
:::

### AdditionalAssemblies

Damit der Blazor-Router Seiten aus `BieberWorks.SDK.UI.MudBlazor` findet (z. B. künftige UI-Seiten), muss die Assembly registriert sein:

```csharp
// Program.cs
builder.Services
    .AddRazorComponents()
    .AddInteractiveServerComponents()
    .AddAdditionalAssemblies(
        typeof(BieberWorks.SDK.UI.MudBlazor.Components.BwThemeProvider).Assembly
        // weitere Modul-Assemblies...
    );
```

Und im Router:

```razor
@code {
    private static readonly Assembly[] _moduleAssemblies =
    [
        typeof(BieberWorks.SDK.UI.MudBlazor.Components.BwThemeProvider).Assembly,
        // weitere...
    ];
}
```
