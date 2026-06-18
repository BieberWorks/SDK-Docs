# SDK-UI — Komponenten

## BwThemeProvider

`BwThemeProvider` ist die Wurzel-Komponente für MudBlazor-Theming. Sie rendert `MudThemeProvider`, `MudPopoverProvider`, `MudDialogProvider` und `MudSnackbarProvider` und schließt `BwViewport` ein.

```razor
<BwThemeProvider>
    @ChildContent
</BwThemeProvider>
```

**Interna:** Die Komponente injiziert `ILayoutThemeContext`, `IThemeService` und `ILayoutThemeProvider`. Bei `OnChanged`-Events beider Services baut sie das `MudTheme` aus `ILayoutThemeProvider.GetThemeData(layoutKey, userId)` neu und ruft `StateHasChanged` auf. Der aktuelle Benutzer wird über `AuthenticationStateProvider` ermittelt.

::: warning Einmaligkeitsregel
`BwThemeProvider` muss **einmal** in `Routes.razor` stehen — nie innerhalb einzelner Layouts. Mehrfache Instanzen führen zu konkurrierenden Theme-Zuständen.
:::

## ILayoutThemeContext

Verwaltet den aktuellen Layout-Key (z. B. `"admin"`, `"account"`). Layouts rufen `Set(key)` beim Initialisieren auf. `BwThemeProvider` lauscht auf `OnChanged` und wechselt die Palette entsprechend.

```csharp
public interface ILayoutThemeContext
{
    string? CurrentLayoutKey { get; }
    void Set(string? key);
    event Action? OnChanged;
}
```

Layouts setzen den Key in `OnInitialized`:

```razor
@inject ILayoutThemeContext LayoutContext

@code {
    protected override void OnInitialized()
    {
        LayoutContext.Set("admin");   // oder "account", null für Default
    }
}
```

## ILayoutThemeProvider

Liefert `LayoutThemeData` (Light- und Dark-Palette als `IReadOnlyDictionary<string, string?>` sowie einen optionalen `LogoStorageKey`) für einen Layout-Key und eine Benutzer-ID.

```csharp
public interface ILayoutThemeProvider
{
    LayoutThemeData GetThemeData(string? layoutKey, string? userId = null);
}
```

Die Standardimplementierung `DefaultLayoutThemeProvider` gibt `LayoutThemeData.Empty` zurück (leere Paletten). SDK-Theme überschreibt diese Registrierung via `TryAddScoped` mit einer datenbankgestützten Implementierung.

## IThemeService

Verwaltet den Dark-Mode-Zustand pro Scoped-Session.

```csharp
public interface IThemeService
{
    bool IsDarkMode { get; }
    void ToggleDarkMode();
    event Action? OnThemeChanged;
}
```

## DarkModeToggle

Fertige AppBar-Komponente ohne Parameter. Injiziert `IThemeService`, abonniert `OnThemeChanged` und rendert einen `MudToggleIconButton` (Sonne / Mond).

```razor
<DarkModeToggle />
```

::: tip Direkte Nutzung in Layouts
`AdminLayout` und `AccountLayout` verwenden `DarkModeToggle` nicht direkt als Komponente, sondern setzen einen `MudToggleIconButton` mit denselben Bindings manuell ein, um Zugriff auf den Lokalisierungs-Tooltip zu haben. `DarkModeToggle` ist für eigene Layouts und Shells gedacht.
:::

## LanguageSwitcher

Dropdown-Menü für den Kulturwechsel. Injiziert `ILanguageService` (aus SDK-Localization) und `NavigationManager`. Wechselt die Kultur über `window.location.assign` auf `/bw/set-culture` — kein Blazor-ForceLoad, kein Circuit-Cleanup-Bug.

```razor
<LanguageSwitcher />
```

**Responsive Verhalten:** Empfängt `BwViewportInfo` als `[CascadingParameter]` von `BwViewport`. Auf `xs`/`sm` zeigt die Komponente nur das Globus-Icon; ab `md` zusätzlich den nativen Namen der aktuellen Sprache.

::: warning Abhängigkeit
`LanguageSwitcher` setzt `ILanguageService` voraus, das von `BieberWorks.SDK.Localization` bereitgestellt wird. Ohne dieses Modul ist die Komponente nicht einsetzbar.
:::

## IAppBarWidget

Contract für Blazor-Komponenten, die Module in die AppBar einbringen. Wird per DI-Enumeration (`IEnumerable<IAppBarWidget>`) von `AdminLayout` und `AccountLayout` gerendert.

```csharp
public interface IAppBarWidget
{
    Type ComponentType { get; }  // Blazor ComponentBase ohne Parameter
    int Order { get; }           // Sortierung, niedrigere Werte zuerst
}
```

**Beispiel — Widget in einem Fachmodul registrieren:**

```csharp
// In IModule.RegisterServices:
services.AddSingleton<IAppBarWidget>(new MyNotificationWidget());
```

```csharp
public sealed class MyNotificationWidget : IAppBarWidget
{
    public Type ComponentType => typeof(NotificationBellComponent);
    public int Order => 200;
}
```

Die Komponente `NotificationBellComponent` muss in einer Assembly liegen, die der Host über `AddAdditionalAssemblies` eingebunden hat.

## BwShellLayout

Gemeinsame responsive Shell-Basis für `AdminLayout` und `AccountLayout`. Nicht direkt für eigene Layouts vorgesehen — Nutzung über die fertigen Shells.

Render-Slots:

| Parameter | Beschreibung |
|---|---|
| `AppBarColor` | `Color`-Enum für `MudAppBar` (Default: `Color.Primary`) |
| `TitleContent` | Titelbereich der AppBar (ab `sm` sichtbar, auf `xs` ausgeblendet) |
| `AppBarContent` | Aktionsbereich rechts in der AppBar (immer sichtbar) |
| `DrawerContent` | Inhalt des `MudDrawer` |
| `BodyContent` | Hauptinhalt (ersetzt `@Body`) |

## BwViewportInfo

Record mit Breakpoint-Snapshot, der von `BwViewport` kaskadiert wird.

```csharp
public sealed record BwViewportInfo(bool IsXs, bool IsSmDown, bool IsMdUp);
```

Seitenkomponenten innerhalb von `BwThemeProvider` (das `BwViewport` enthält) können per `[CascadingParameter]` darauf zugreifen:

```razor
@code {
    [CascadingParameter]
    public BwViewportInfo? Viewport { get; set; }
}
```

## ICookieConsentService / CookieBanner

`ICookieConsentService` verwaltet Cookie-Einwilligungen pro Kategorie (`Necessary`, `Functional`, `Analytics`, `Marketing`). Module registrieren ihre Cookies via `CookieRegistration`.

```csharp
public interface ICookieConsentService
{
    bool IsConsentGiven(CookieCategory category);
    Task SetConsentAsync(IReadOnlyDictionary<CookieCategory, bool> choices);
    Task LoadConsentAsync();
    IReadOnlyList<CookieRegistration> GetRegistrations();
    event Action? OnConsentChanged;
}
```

`CookieBanner` ist die zugehörige UI-Komponente, die bei fehlendem Consent angezeigt wird.

## Component Override System

Das Override-System erlaubt es einem Host, einzelne SDK-Seiten oder Layouts durch eigene Komponenten zu ersetzen, ohne Route-Konflikte zu erzeugen.

```csharp
// Program.cs
builder.Services.OverridePage(
    sdkType:  typeof(SomeSdkPage),
    hostType: typeof(MyCustomPage));
```

`BwRouter` (der benutzerdefinierte Router aus SDK-UI) unterdrückt die SDK-Route automatisch und rendert stattdessen die Host-Komponente. Die Host-Komponente braucht keine eigene `@page`-Direktive.

Weitere Extension-Methoden: `OverrideLayout(...)`, `OverrideComponent(...)` — alle leiten intern auf `OverridePage` weiter.
