# Setup — SDK-Localization

## NuGet-Pakete installieren

```xml
<!-- Host .csproj -->
<PackageReference Include="BieberWorks.SDK.Localization" Version="0.*-*" />
<PackageReference Include="BieberWorks.SDK.Localization.UI.MudBlazor" Version="0.*-*" />
```

::: tip Contracts für andere Module
Module, die `ITranslationAdminService` injizieren wollen, referenzieren nur:
```xml
<PackageReference Include="BieberWorks.SDK.Localization.Contracts" Version="0.*-*" />
```
:::

## Program.cs

SDK-Localization registriert sich als `IModule` und wird daher automatisch von `AddBieberWorksModules` erfasst. Zusätzlich muss die Admin-UI explizit hinzugefügt werden:

```csharp
using BieberWorks.SDK.Localization.UI.MudBlazor.Extensions;

// Alle Module laden (Foundation, Auth, Localization, …)
builder.Services.AddBieberWorksModules(builder.Configuration);

// Localization Admin-UI im Admin-Shell registrieren
builder.Services.AddLocalizationUi();
```

### Assembly-Registrierung (Blazor Router)

Das UI-Paket enthält Razor-Seiten — sie müssen dem Blazor-Router bekannt gemacht werden:

```csharp
// Program.cs
app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode()
    .AddAdditionalAssemblies(
        typeof(BieberWorks.SDK.Localization.UI.MudBlazor.AdminSection.LocalizationAdminSection).Assembly);
```

```razor
<!-- Routes.razor -->
<Router AppAssembly="typeof(App).Assembly"
        AdditionalAssemblies="new[]
        {
            typeof(BieberWorks.SDK.Localization.UI.MudBlazor.AdminSection.LocalizationAdminSection).Assembly
        }">
```

### Optionale Konfiguration: LocalizationScanOptions

Wenn eigene (nicht `BieberWorks.SDK.*`-) Assemblies in der Key-Discovery berücksichtigt werden sollen:

```csharp
builder.Services.Configure<LocalizationScanOptions>(options =>
{
    options.AdditionalAssemblyPrefixes.Add("MyApp.");

    // Optionale Anzeigenamen in der Admin-UI:
    options.SetDisplayName("Auth", "Authentifizierung")
           .SetDisplayName("MyApp", "Eigene Texte");
});
```

## appsettings.json

Das Modul sucht den Connection String in dieser Reihenfolge: `LocalizationDb` → `DefaultConnection` → `AuthDb`.

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Database=myapp;Username=myuser;Password=secret"
  }
}
```

Alternativ mit eigenem Connection String:

```json
{
  "ConnectionStrings": {
    "LocalizationDb": "Host=localhost;Database=myapp;Username=myuser;Password=secret"
  }
}
```

## Migrations

Das Modul wendet seine Migrations beim Start automatisch an (`IModuleInitializer.InitializeAsync`). Ein manueller `dotnet ef database update` ist im Normal-Betrieb nicht erforderlich.

**PostgreSQL-Schema:** `localization`

**Tabellen:**

| Tabelle | Zweck |
|---|---|
| `localization.Translations` | Gespeicherte DB-Overrides (Module, Key, Culture, Value) |
| `localization.__EFMigrationsHistory` | EF-Migrations-Tracking |

### Migrations manuell generieren (nur Modul-Entwicklung)

```bash
dotnet ef migrations add <Name> \
  --project src/BieberWorks.SDK.Localization.Contracts \
  --startup-project <HostProject>
```

::: warning --no-build vermeiden
Immer ohne `--no-build` ausführen, damit EF die aktuelle DLL verwendet. Andernfalls entstehen fehlerhafte Migrations aus veralteten Assemblies.
:::
