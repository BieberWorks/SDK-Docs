# Setup — SDK-Settings

## NuGet-Pakete installieren

```xml
<!-- Host .csproj -->
<PackageReference Include="BieberWorks.SDK.Settings" Version="0.*-*" />
<PackageReference Include="BieberWorks.SDK.Settings.UI.MudBlazor" Version="0.*-*" />
```

::: tip Contracts für andere Module
Module, die `ISettingsService` oder `IFeatureFlagService` injizieren:
```xml
<PackageReference Include="BieberWorks.SDK.Settings.Contracts" Version="0.*-*" />
```
:::

## Program.cs

`SettingsModule` registriert sich als `IModule` und wird von `AddBieberWorksModules` automatisch erfasst. Die Admin-UI muss separat hinzugefügt werden:

```csharp
using BieberWorks.SDK.Settings.Extensions;
using BieberWorks.SDK.Settings.UI.MudBlazor.Extensions;

// Alle Module laden (Foundation, Auth, Settings, …)
builder.Services.AddBieberWorksModules(builder.Configuration);

// Settings Admin-UI im Admin-Shell registrieren
builder.Services.AddSettingsUi();

// Settings-Definitionen deklarieren (idempotent in DB geseedet beim Start)
builder.Services.AddSettingDefinition(new AppSettingDefinition(
    Key:          "ui:items-per-page",
    Section:      "ui",
    Type:         AppSettingType.Integer,
    DefaultValue: "25",
    Description:  "Anzahl der Einträge pro Seite in Tabellen"));

builder.Services.AddSettingDefinition(new AppSettingDefinition(
    Key:          "feature:new-dashboard",
    Section:      "features",
    Type:         AppSettingType.Boolean,
    DefaultValue: "false",
    Description:  "Neues Dashboard aktivieren"));
```

### Assembly-Registrierung (Blazor Router)

```csharp
// Program.cs
app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode()
    .AddAdditionalAssemblies(
        typeof(BieberWorks.SDK.Settings.UI.MudBlazor.AdminSection.SettingsAdminSection).Assembly);
```

```razor
<!-- Routes.razor -->
<Router AppAssembly="typeof(App).Assembly"
        AdditionalAssemblies="new[]
        {
            typeof(BieberWorks.SDK.Settings.UI.MudBlazor.AdminSection.SettingsAdminSection).Assembly
        }">
```

## appsettings.json

Das Modul sucht den Connection String in dieser Reihenfolge: `SettingsDb` → `DefaultConnection` → `AuthDb`.

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Database=myapp;Username=myuser;Password=secret"
  }
}
```

## Migrations

Das Modul wendet seine Migrations beim Start automatisch an (`IModuleInitializer.InitializeAsync`). Unmittelbar danach werden alle registrierten `AppSettingDefinition`-Instanzen idempotent in die Datenbank geseedet.

**PostgreSQL-Schema:** `settings`

**Tabellen:**

| Tabelle | Zweck |
|---|---|
| `settings.AppSettingDefinitions` | Bekannte Setting-Keys (Key, Section, Type, DefaultValue, Description) |
| `settings.AppSettingValues` | Gesetzte Werte (Value, LastModifiedAt, LastModifiedBy) |
| `settings.__EFMigrationsHistory` | EF-Migrations-Tracking |

::: warning --no-build vermeiden
Migrations immer ohne `--no-build` generieren, damit EF die aktuelle DLL liest.
:::
