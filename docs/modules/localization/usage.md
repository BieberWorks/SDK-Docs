# Usage — SDK-Localization

## Create resx Files

Each module that provides localizable text creates resource files as Embedded Resources:

```
src/MyModule.Contracts/Resources/
    MyModuleResources.resx        ← Neutral/English fallback
    MyModuleResources.de.resx     ← German translations
    MyModuleResources.fr.resx     ← Additional languages
```

The file is included in the `.csproj` as an Embedded Resource:

```xml
<ItemGroup>
  <EmbeddedResource Include="Resources\*.resx" />
</ItemGroup>
```

Each `.resx` file contains key-value pairs:

```xml
<!-- MyModuleResources.resx -->
<data name="Login_Label_Password" xml:space="preserve">
  <value>Password</value>
</data>
<data name="Login_Error_InvalidCredentials" xml:space="preserve">
  <value>Invalid email or password.</value>
</data>
```

## Key Discovery

SDK-Localization scans all loaded assemblies on startup and extracts resource keys. The translation editor then displays all keys with their default value (from the neutral `.resx`) and allows creating database overrides per culture.

**Automatically scanned assemblies:** all whose name starts with `BieberWorks.SDK.`

**Custom prefixes** must be registered in `LocalizationScanOptions`:

```csharp
// Program.cs
builder.Services.Configure<LocalizationScanOptions>(options =>
{
    options.AdditionalAssemblyPrefixes.Add("MyApp.");
    options.SetDisplayName("MyModule", "My Module");
});
```

Keys from `MyApp.MyModule.Resources.MyModuleResources` then appear in the translation editor under the group "My Module".

## Use IStringLocalizer

After registration, `IStringLocalizer<T>` is available in every component and service. The database override layer is transparently integrated — the call remains identical to standard .NET localization:

```csharp
using Microsoft.Extensions.Localization;

public class MyComponent : ComponentBase
{
    [Inject] IStringLocalizer<MyResources> Loc { get; set; } = default!;

    // Access a localized string
    string label = Loc["Login_Label_Password"];
}
```

If a database override exists for the current culture context, it is returned. Otherwise, the `.resx` value is used.

## Switch Language (Browser Language Switch)

The culture switch occurs via the Foundation endpoint `/bw/set-culture`. It sets a culture cookie and redirects to the referrer:

```html
<a href="/bw/set-culture?culture=de&redirectUri=/">Deutsch</a>
<a href="/bw/set-culture?culture=en&redirectUri=/">English</a>
```

Available languages are provided by `ILanguageService.AvailableCultures` (configured in Foundation).

## Set Database Override Programmatically

`ITranslationAdminService` is available for direct programmatic changes:

```csharp
using BieberWorks.SDK.Localization.Contracts;

public class MyMigrationService(ITranslationAdminService adminService)
{
    public async Task SeedGermanOverridesAsync()
    {
        await adminService.SetOverrideAsync(
            module:  "Auth",
            key:     "Login_Label_Password",
            culture: "de",
            value:   "Passwort");
    }
}
```

The cache is automatically invalidated after each `SetOverrideAsync` call.

## Delete Database Override

```csharp
await adminService.ClearOverrideAsync(
    module:  "Auth",
    key:     "Login_Label_Password",
    culture: "de");
```

After deletion, the localizer falls back to the `.resx` default value.

## Get All Keys of a Module

`GetKeysAsync` returns for each known key the `.resx` default value and all existing database overrides per culture:

```csharp
IReadOnlyList<TranslationKeyView> keys = await adminService.GetKeysAsync("Auth");

foreach (var key in keys)
{
    Console.WriteLine($"{key.Key} (Default: {key.DefaultValue})");
    foreach (var (culture, ov) in key.Overrides)
        Console.WriteLine($"  [{culture}] {ov ?? "(no override)"}");
}
```

For paginated retrieval, use `GetKeysPagedAsync`:

```csharp
PagedResult<TranslationKeyView> paged = await adminService.GetKeysPagedAsync(
    module: "Auth",
    page: 1,
    pageSize: 50);
```

`TranslationKeyView` is a `record` with properties:

| Property | Type | Meaning |
|---|---|---|
| `Key` | `string` | Resource key, e.g., `Login_Label_Password` |
| `DefaultValue` | `string` | Neutral/English `.resx` value |
| `Overrides` | `IReadOnlyDictionary<string, string?>` | Database overrides per BCP-47 culture; `null` = no override |

## Admin UI

The admin UI is accessible under the admin shell path (typically `/admin`). SDK-Localization automatically registers itself as an admin section named **Translations**.

The translation editor shows:
1. A module selection list (all modules discovered via assembly scan)
2. Per module, a table of all keys with default value and editable override fields per culture
3. Save and reset actions per key/culture combination

::: info Permission
Access to the admin section requires the permission `localization:translations:manage` (`LocalizationPermissions.TranslationsManage`).
:::

## Adding a New Language

To add a new culture (e.g. French) to your application:

### 1. Configure Supported Cultures in Program.cs

```csharp
// Replace the culture list with all cultures you support
builder.Services.AddBieberWorksLocalization("en", "de", "fr");
```

`AddBieberWorksLocalization` configures `RequestLocalizationOptions.SupportedCultures` and `SupportedUICultures` and registers `ILanguageService` with the provided list.

### 2. Add .resx Files to Each Module

For every module that has localizable text, add a culture-specific `.resx` file alongside the existing neutral and German files:

```
src/MyModule.Contracts/Resources/
    MyModuleResources.resx        ← Neutral/English fallback
    MyModuleResources.de.resx     ← German
    MyModuleResources.fr.resx     ← French (new)
```

The file must be an `EmbeddedResource` in the `.csproj`:

```xml
<ItemGroup>
  <EmbeddedResource Include="Resources\*.resx" />
</ItemGroup>
```

### 3. Test the Culture Switch

Navigate to the set-culture endpoint to activate the new language:

```
/bw/set-culture?culture=fr&redirectUri=/
```

The `LanguageSwitcher` component (SDK-UI) shows all cultures registered via `AddBieberWorksLocalization` and links to this endpoint automatically.

### 4. Override Individual Strings at Runtime

Once the new culture is active, SDK-Localization's admin UI at `/admin/localization` shows the French column in the translation editor. You can add DB overrides per key without redeployment — useful for translations that differ from the `.resx` default or for rapid iteration.

---

## Add Custom Assembly Prefixes

To include custom texts (e.g., `MyApp.Core.Resources`) in the translation editor:

```csharp
builder.Services.Configure<LocalizationScanOptions>(options =>
{
    options.AdditionalAssemblyPrefixes.Add("MyApp.");
    options.SetDisplayName("MyApp", "My Application");
});
```

The assembly scan then additionally looks for embedded resources whose base name starts with `MyApp.`.
