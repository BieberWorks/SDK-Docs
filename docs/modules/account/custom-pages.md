# SDK-Account — Eigene Account-Seiten

Andere Module klinken eigene Self-Service-Seiten in den Account-Bereich ein, indem sie `IAccountSection` implementieren und die Seiten mit `IAccountPage` markieren.

## IAccountPage

Marker-Interface für routable Blazor-Seiten, die im Account-Bereich liegen.

```csharp
public interface IAccountPage;
```

Durch dieses Interface können Tools oder Filter alle Account-Seiten der Assembly identifizieren. Es hat keine Pflicht-Member.

## IAccountSection

Gruppert mehrere `AccountNavItem`-Links unter einem Drawer-Eintrag.

```csharp
public interface IAccountSection
{
    string Title { get; }
    string Icon  { get; }
    int    Order { get; }
    IReadOnlyList<AccountNavItem> NavItems { get; }

    // Optional: Permission-Key (null = immer sichtbar)
    string? RequiredPermission => null;

    // Optional: Sektion bei Runtime ausblenden
    bool IsEnabled(IServiceProvider services) => true;
}
```

| Member | Beschreibung |
|---|---|
| `Title` | Anzeigename im Drawer (z. B. `"Meine Dateien"`) |
| `Icon` | MudBlazor-Icon-Konstante (z. B. `Icons.Material.Filled.Folder`) |
| `Order` | Sortierung; kleinere Werte erscheinen weiter oben |
| `NavItems` | Liste der Navigationslinks dieser Sektion |
| `RequiredPermission` | Optionaler Permission-Key im Format `{modul}:{ressource}:{aktion}`; `null` = immer sichtbar |
| `IsEnabled` | Optionale Laufzeit-Bedingung; default `true` |

::: info Unterschied zu IAdminSection
`IAccountSection` besitzt `RequiredPermission` — damit kann eine Sektion für bestimmte User ausgeblendet werden, ohne den gesamten Account-Bereich zu schützen. `IAdminSection` nutzt stattdessen nur `IsEnabled` und schützt den gesamten Body pauschal über `perm:admin:shell:access`.
:::

## AccountNavItem

```csharp
public sealed record AccountNavItem(string Title, string Href, string Icon);
```

| Parameter | Beschreibung |
|---|---|
| `Title` | Link-Label im Drawer |
| `Href` | Route-URL (z. B. `"/account/files"`) |
| `Icon` | MudBlazor-Icon-Konstante |

## Vollständiges Beispiel

### 1. Sektion implementieren

```csharp
// MyModule/Account/MyAccountSection.cs
using BieberWorks.SDK.Account.Contracts;
using MudBlazor;

public sealed class MyAccountSection : IAccountSection
{
    public string Title => "Meine Dateien";
    public string Icon  => Icons.Material.Filled.Folder;
    public int    Order => 100;

    public IReadOnlyList<AccountNavItem> NavItems =>
    [
        new AccountNavItem("Übersicht", "/account/files",        Icons.Material.Filled.FolderOpen),
        new AccountNavItem("Uploads",   "/account/files/upload", Icons.Material.Filled.Upload),
    ];

    // Nur sichtbar, wenn die Permission vorhanden ist
    public string? RequiredPermission => "storage:files:read";
}
```

### 2. Sektion im DI registrieren

```csharp
// In IModule.RegisterServices oder Program.cs
services.AddSingleton<IAccountSection, MyAccountSection>();
```

::: warning Registrierungszeitpunkt
`IAccountSection`-Implementierungen müssen vor dem ersten Render der `AccountLayout` im DI-Container stehen. Das ist sichergestellt, wenn sie in `IModule.RegisterServices` registriert werden.
:::

### 3. Account-Seite anlegen

```razor
@* Pages/Account/MyFilesPage.razor *@
@page "/account/files"
@layout AccountLayout
@implements IAccountPage

<h1>Meine Dateien</h1>
```

::: tip @layout
Die Direktive `@layout AccountLayout` ist notwendig, damit die Seite innerhalb der Account-Shell gerendert wird. Alternativ kann `AccountShell` als `DefaultLayout` im Router-Scope gesetzt werden.
:::

### 4. Assembly einbinden

Die Assembly, die die Seite enthält, muss im Host in `AddAdditionalAssemblies` registriert sein:

```csharp
// Program.cs
builder.Services
    .AddRazorComponents()
    .AddInteractiveServerComponents()
    .AddAdditionalAssemblies(
        typeof(BieberWorks.SDK.Account.UI.MudBlazor.AccountModule).Assembly,
        typeof(MyModule.Account.MyFilesPage).Assembly
    );
```

Und in `Routes.razor`:

```razor
@code {
    private static readonly Assembly[] _moduleAssemblies =
    [
        typeof(BieberWorks.SDK.Account.UI.MudBlazor.AccountModule).Assembly,
        typeof(MyModule.Account.MyFilesPage).Assembly,
    ];
}
```

## RequiredPermission — Permission-basierte Sichtbarkeit

`AccountLayout` prüft `RequiredPermission` für jede Sektion und rendert sie in `<AuthorizeView Policy="perm:{key}">`, wenn ein Wert gesetzt ist:

```razor
@* Intern in AccountLayout *@
@if (section.RequiredPermission is null)
{
    <MudNavGroup ...>...</MudNavGroup>
}
else
{
    <AuthorizeView Policy="@($"perm:{section.RequiredPermission}")">
        <Authorized>
            <MudNavGroup ...>...</MudNavGroup>
        </Authorized>
    </AuthorizeView>
}
```

Der Benutzer sieht die Sektion nur, wenn er die entsprechende Permission trägt. Die Seiten selbst sind durch `@layout AccountLayout` und das Rendering-Verhalten geschützt, sollten aber zusätzlich eigene `[Authorize]`-Attribute tragen.

## IsEnabled — Feature-Flag-basierte Sichtbarkeit

```csharp
public bool IsEnabled(IServiceProvider services)
{
    var flags = services.GetService<IFeatureFlagService>();
    return flags?.IsEnabled("MyModule.Files") ?? true;
}
```

`AccountLayout` evaluiert `IsEnabled` beim Render (in der `@foreach`-Schleife) und überspringt deaktivierte Sektionen.
