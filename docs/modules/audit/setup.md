# Setup & Konfiguration

## NuGet-Pakete installieren

Für ein reines Backend-Projekt (ohne Admin-UI):

```bash
dotnet add package BieberWorks.SDK.Audit.Contracts
dotnet add package BieberWorks.SDK.Audit
```

Mit Admin-UI (MudBlazor):

```bash
dotnet add package BieberWorks.SDK.Audit.Contracts
dotnet add package BieberWorks.SDK.Audit
dotnet add package BieberWorks.SDK.Audit.UI
dotnet add package BieberWorks.SDK.Audit.UI.MudBlazor
```

::: info Pakete kommen aus GitHub Packages
Die Pakete werden aus der `BieberWorks`-GitHub-Org bezogen. Eine entsprechende `nuget.config` mit dem `PACKAGES_TOKEN` ist Voraussetzung.
:::

## Program.cs

Das Modul registriert sich selbst über `AddBieberWorksModules`. Kein manueller `services.Add...`-Aufruf nötig — `AuditModule.RegisterServices` erledigt das automatisch:

```csharp
builder.Services.AddBieberWorksModules(builder.Configuration);
```

Für die Admin-UI zusätzlich `AddAuditUi()` aufrufen:

```csharp
builder.Services.AddAuditUi();
```

Optional kann `AddAuditUi` mit einem Konfigurationsdelegate aufgerufen werden, um Verlinkungen in der Tabelle zu aktivieren:

```csharp
builder.Services.AddAuditUi(options =>
{
    // Benutzer-IDs in der Tabelle als Links rendern
    options.UserLinkTemplate = "/admin/users/{0}";

    // Resource-IDs je Ressourcentyp verlinken
    options.ResourceLinkTemplates["Role"] = "/admin/users/roles/{0}";
    options.ResourceLinkTemplates["User"] = "/admin/users/{0}";
});
```

Anschließend Endpoints mappen:

```csharp
app.MapBieberWorksModules();
```

Und Migrations beim Start anwenden:

```csharp
await app.InitializeBieberWorksModulesAsync();
```

## Verbindungsstring

Das Modul sucht in dieser Reihenfolge nach einer Connection String:

1. `ConnectionStrings:AuditDb`
2. `ConnectionStrings:DefaultConnection`
3. `ConnectionStrings:AuthDb`

```json
{
  "ConnectionStrings": {
    "AuditDb": "Host=localhost;Database=bieberworks;Username=...;Password=..."
  }
}
```

::: tip Gemeinsame Datenbank, getrenntes Schema
Es kann dieselbe PostgreSQL-Datenbank wie andere Module verwendet werden. SDK-Audit legt alle Tabellen im Schema `audit` ab und kollidiert nicht mit anderen Modulen.
:::

## PostgreSQL-Schema `audit`

`AuditModule` implementiert `IModuleInitializer` und führt beim Start automatisch `db.Database.MigrateAsync()` aus. Manueller `dotnet ef database update` ist für Produktionsumgebungen optional, aber nicht erforderlich, wenn `InitializeBieberWorksModulesAsync()` aufgerufen wird.

Die EF-Migrations-History-Tabelle wird ebenfalls im Schema `audit` abgelegt:

```
audit.__EFMigrationsHistory
audit.AuditItems
```

## Blazor-Router (nur bei Admin-UI)

Damit der Blazor-Router die Seiten aus dem UI-Paket findet, müssen die Assemblies in `Program.cs` und in `Routes.razor` eingetragen werden:

```csharp
// Program.cs
app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode()
    .AddAdditionalAssemblies(
        typeof(BieberWorks.SDK.Audit.UI.MudBlazor._Imports).Assembly,
        typeof(BieberWorks.SDK.Audit.UI._Imports).Assembly);
```

```razor
<!-- Routes.razor -->
<Router AppAssembly="typeof(App).Assembly"
        AdditionalAssemblies="new[]
        {
            typeof(BieberWorks.SDK.Audit.UI.MudBlazor._Imports).Assembly,
            typeof(BieberWorks.SDK.Audit.UI._Imports).Assembly
        }">
    ...
</Router>
```
