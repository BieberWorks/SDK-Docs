# Setup — SDK-Settings

## NuGet packages

```xml
<!-- Host .csproj -->
<PackageReference Include="BieberWorks.SDK.Settings" Version="0.*-*" />
<PackageReference Include="BieberWorks.SDK.Settings.UI.MudBlazor" Version="0.*-*" />
```

::: tip Contracts for other modules
Modules that inject `ISettingsService` or `IFeatureFlagService`:
```xml
<PackageReference Include="BieberWorks.SDK.Settings.Contracts" Version="0.*-*" />
```
:::

## Program.cs

`SettingsModule` registers itself as `IModule` and is automatically captured by `AddBieberWorksModules`. The admin UI must be added separately:

```csharp
using BieberWorks.SDK.Settings.Extensions;
using BieberWorks.SDK.Settings.UI.MudBlazor.Extensions;

// Load all modules (Foundation, Auth, Settings, …)
builder.Services.AddBieberWorksModules(builder.Configuration);

// Register settings admin UI in the admin shell
builder.Services.AddSettingsUi();

// Declare setting definitions (idempotently seeded to DB on startup)
builder.Services.AddSettingDefinition(new AppSettingDefinition(
    Key:          "ui:items-per-page",
    Section:      "ui",
    Type:         AppSettingType.Integer,
    DefaultValue: "25",
    Description:  "Number of items per page in tables"));

builder.Services.AddSettingDefinition(new AppSettingDefinition(
    Key:          "feature:new-dashboard",
    Section:      "features",
    Type:         AppSettingType.Boolean,
    DefaultValue: "false",
    Description:  "Enable new dashboard"));
```

### Assembly registration (Blazor router)

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

The module searches for the connection string in this order: `SettingsDb` → `DefaultConnection` → `AuthDb`.

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Database=myapp;Username=myuser;Password=secret"
  }
}
```

## Migrations

The module automatically applies its migrations on startup (`IModuleInitializer.InitializeAsync`). Immediately after, all registered `AppSettingDefinition` instances are idempotently seeded into the database.

**PostgreSQL schema:** `settings`

**Tables:**

| Table | Purpose |
|---|---|
| `settings.AppSettingDefinitions` | Known setting keys (key, section, type, default value, description) |
| `settings.AppSettingValues` | Set values (value, last modified at, last modified by) |
| `settings.__EFMigrationsHistory` | EF migrations tracking |

::: warning Avoid --no-build
Always generate migrations without `--no-build`, so EF reads the current DLL.
:::
