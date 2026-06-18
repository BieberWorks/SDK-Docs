# SDK-Admin — Eigene Admin-Seiten

Andere Module klinken eigene Seiten in den Admin-Bereich ein, indem sie `IAdminSection` implementieren und die Seiten mit `IAdminPage` markieren.

## IAdminPage

Marker-Interface für routable Blazor-Seiten, die im Admin-Bereich liegen.

```csharp
// BieberWorks.SDK.Admin
public interface IAdminPage { }
```

Durch dieses Interface können Tools oder Filter alle Admin-Seiten der Assembly identifizieren. Es hat keine Pflicht-Member.

## IAdminSection

Gruppert mehrere `AdminNavItem`-Links unter einem Drawer-Eintrag.

```csharp
public interface IAdminSection
{
    string Title { get; }
    string Icon  { get; }
    int    Order { get; }
    IReadOnlyList<AdminNavItem> NavItems { get; }

    // Optional: Sektion bei Runtime ausblenden
    bool IsEnabled(IServiceProvider services) => true;
}
```

| Member | Beschreibung |
|---|---|
| `Title` | Anzeigename im Drawer (z. B. `"Einstellungen"`) |
| `Icon` | MudBlazor-Icon-Konstante (z. B. `Icons.Material.Filled.Settings`) |
| `Order` | Sortierung; kleinere Werte erscheinen weiter oben |
| `NavItems` | Liste der Navigationslinks dieser Sektion |
| `IsEnabled` | Optionale Laufzeit-Bedingung; default `true` |

## AdminNavItem

```csharp
public sealed record AdminNavItem(string Title, string Href, string Icon);
```

| Parameter | Beschreibung |
|---|---|
| `Title` | Link-Label im Drawer |
| `Href` | Route-URL (z. B. `"/admin/settings"`) |
| `Icon` | MudBlazor-Icon-Konstante |

## Vollständiges Beispiel

### 1. Sektion implementieren

```csharp
// MyModule/Admin/MyAdminSection.cs
using BieberWorks.SDK.Admin.Contracts;
using MudBlazor;

public sealed class MyAdminSection : IAdminSection
{
    public string Title => "Mein Modul";
    public string Icon  => Icons.Material.Filled.Extension;
    public int    Order => 300;

    public IReadOnlyList<AdminNavItem> NavItems =>
    [
        new AdminNavItem("Übersicht",     "/admin/mymodule",          Icons.Material.Filled.Dashboard),
        new AdminNavItem("Konfiguration", "/admin/mymodule/settings", Icons.Material.Filled.Tune),
    ];
}
```

### 2. Sektion im DI registrieren

```csharp
// In IModule.RegisterServices oder Program.cs
services.AddSingleton<IAdminSection, MyAdminSection>();
```

::: warning Registrierungszeitpunkt
`IAdminSection`-Implementierungen müssen vor dem ersten Render der `AdminLayout` im DI-Container stehen. Das ist sichergestellt, wenn sie in `IModule.RegisterServices` (das vor dem App-Build ausgeführt wird) registriert werden.
:::

### 3. Admin-Seite anlegen

```razor
@* Pages/Admin/MyOverviewPage.razor *@
@page "/admin/mymodule"
@layout AdminLayout
@implements IAdminPage

<h1>Mein Modul — Übersicht</h1>
```

::: tip @layout
Die Direktive `@layout AdminLayout` ist notwendig, damit die Seite innerhalb der Admin-Shell gerendert wird. Alternativ kann `AdminShell` als `DefaultLayout` im Router-Scope gesetzt werden.
:::

### 4. Assembly einbinden

Die Assembly, die die Seite enthält, muss im Host in `AddAdditionalAssemblies` registriert sein:

```csharp
// Program.cs
builder.Services
    .AddRazorComponents()
    .AddInteractiveServerComponents()
    .AddAdditionalAssemblies(
        typeof(BieberWorks.SDK.Admin.UI.MudBlazor.AdminModule).Assembly,
        typeof(MyModule.Admin.MyOverviewPage).Assembly
    );
```

Und in `Routes.razor`:

```razor
@code {
    private static readonly Assembly[] _moduleAssemblies =
    [
        typeof(BieberWorks.SDK.Admin.UI.MudBlazor.AdminModule).Assembly,
        typeof(MyModule.Admin.MyOverviewPage).Assembly,
    ];
}
```

## IsEnabled — Bedingte Sektionen

`IsEnabled` erhält den `IServiceProvider`, um Feature-Flags oder andere Runtime-Bedingungen abzufragen:

```csharp
public bool IsEnabled(IServiceProvider services)
{
    var flags = services.GetService<IFeatureFlagService>();
    return flags?.IsEnabled("MyModule") ?? true;
}
```

`AdminLayout` evaluiert `IsEnabled` in `OnInitialized` und filtert deaktivierte Sektionen heraus.

## Drag-and-Drop Reihenfolge

`AdminLayout` erlaubt Benutzern mit der Permission `admin:shell:access` das Umsortieren der Sektionen per Drag-and-Drop (Edit-Mode-Button im Drawer-Header). Die Reihenfolge wird in SDK-Settings unter dem Key `admin.nav.section-order` als JSON-Array von Typnamen persistiert — sofern SDK-Settings im Host installiert ist. Ohne SDK-Settings wird die Reihenfolge nur für die aktuelle Session gehalten.
