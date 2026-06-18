# Setup — SDK-Localization

## Install NuGet Packages

```xml
<!-- Host .csproj -->
<PackageReference Include="BieberWorks.SDK.Localization" Version="0.*-*" />
<PackageReference Include="BieberWorks.SDK.Localization.UI.MudBlazor" Version="0.*-*" />
```

::: tip Contracts for Other Modules
Modules that want to inject `ITranslationAdminService` reference only:
```xml
<PackageReference Include="BieberWorks.SDK.Localization.Contracts" Version="0.*-*" />
```
:::

## Program.cs

SDK-Localization registers itself as `IModule` and is therefore automatically discovered by `AddBieberWorksModules`. Additionally, the admin UI must be explicitly added:

```csharp
using BieberWorks.SDK.Localization.UI.MudBlazor.Extensions;

// Load all modules (Foundation, Auth, Localization, …)
builder.Services.AddBieberWorksModules(builder.Configuration);

// Register Localization Admin UI in the Admin Shell
builder.Services.AddLocalizationUi();
```

### Assembly Registration (Blazor Router)

The UI package contains Razor pages — they must be made known to the Blazor router:

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

### Optional Configuration: LocalizationScanOptions

If own (non-`BieberWorks.SDK.*`) assemblies should be included in key discovery:

```csharp
builder.Services.Configure<LocalizationScanOptions>(options =>
{
    options.AdditionalAssemblyPrefixes.Add("MyApp.");

    // Optional display names in the admin UI:
    options.SetDisplayName("Auth", "Authentication")
           .SetDisplayName("MyApp", "Custom Texts");
});
```

## appsettings.json

The module searches for the connection string in this order: `LocalizationDb` → `DefaultConnection` → `AuthDb`.

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Database=myapp;Username=myuser;Password=secret"
  }
}
```

Alternatively with a dedicated connection string:

```json
{
  "ConnectionStrings": {
    "LocalizationDb": "Host=localhost;Database=myapp;Username=myuser;Password=secret"
  }
}
```

## Migrations

The module applies its migrations automatically at startup (`IModuleInitializer.InitializeAsync`). Manual `dotnet ef database update` is not required during normal operation.

**PostgreSQL Schema:** `localization`

**Tables:**

| Table | Purpose |
|---|---|
| `localization.Translations` | Stored DB overrides (modules, keys, cultures, values) |
| `localization.__EFMigrationsHistory` | EF migrations tracking |

### Generate Migrations Manually (module development only)

```bash
dotnet ef migrations add <Name> \
  --project src/BieberWorks.SDK.Localization.Contracts \
  --startup-project <HostProject>
```

::: warning Avoid --no-build
Always run without `--no-build` so EF uses the current DLL. Otherwise, faulty migrations result from outdated assemblies.
:::
