# Verwendung — SDK-Localization

## IStringLocalizer verwenden

Nach der Registrierung ist `IStringLocalizer<T>` in jeder Komponente und jedem Service nutzbar. Die DB-Override-Schicht ist transparent eingehängt — der Aufruf bleibt identisch zur Standard-.NET-Lokalisierung:

```csharp
using Microsoft.Extensions.Localization;

public class MyComponent : ComponentBase
{
    [Inject] IStringLocalizer<MyResources> Loc { get; set; } = default!;

    // Zugriff auf einen lokalisierenden String
    string label = Loc["Login_Label_Password"];
}
```

Existiert ein DB-Override für den aktuellen Kultur-Kontext, wird dieser zurückgegeben. Andernfalls greift der `.resx`-Wert.

## Sprache wechseln (Browser-Language-Switch)

Der Culture-Switch erfolgt über den Foundation-Endpunkt `/bw/set-culture`. Dieser setzt ein Culture-Cookie und leitet zur Ausgangsseite zurück:

```html
<a href="/bw/set-culture?culture=de&redirectUri=/">Deutsch</a>
<a href="/bw/set-culture?culture=en&redirectUri=/">English</a>
```

Die verfügbaren Sprachen werden über `ILanguageService.AvailableCultures` bereitgestellt (in Foundation konfiguriert).

## DB-Override programmatisch setzen

`ITranslationAdminService` steht für direkte programmatische Änderungen zur Verfügung:

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

Der Cache wird nach jedem `SetOverrideAsync`-Aufruf automatisch invalidiert.

## DB-Override löschen

```csharp
await adminService.ClearOverrideAsync(
    module:  "Auth",
    key:     "Login_Label_Password",
    culture: "de");
```

Nach dem Löschen fällt der Localizer auf den `.resx`-Standardwert zurück.

## Alle Keys eines Moduls abrufen

`GetKeysAsync` liefert für jedes bekannte Key den `.resx`-Standardwert sowie alle vorhandenen DB-Overrides pro Culture:

```csharp
IReadOnlyList<TranslationKeyView> keys = await adminService.GetKeysAsync("Auth");

foreach (var key in keys)
{
    Console.WriteLine($"{key.Key} (Default: {key.DefaultValue})");
    foreach (var (culture, ov) in key.Overrides)
        Console.WriteLine($"  [{culture}] {ov ?? "(kein Override)"}");
}
```

`TranslationKeyView` ist ein `record` mit den Properties:

| Property | Typ | Bedeutung |
|---|---|---|
| `Key` | `string` | Resource-Key, z. B. `Login_Label_Password` |
| `DefaultValue` | `string` | Neutraler/englischer `.resx`-Wert |
| `Overrides` | `IReadOnlyDictionary<string, string?>` | DB-Overrides per BCP-47-Culture; `null` = kein Override |

## Admin-UI

Die Admin-UI ist unter dem Admin-Shell-Pfad erreichbar (normalerweise `/admin`). SDK-Localization registriert sich automatisch als Admin-Section mit dem Namen **Translations**.

Der Translation-Editor zeigt:
1. Eine Modul-Auswahlliste (alle per Assembly-Scan entdeckten Module)
2. Pro Modul eine Tabelle aller Keys mit Standardwert und editierbaren Override-Feldern je Culture
3. Speichern- und Zurücksetzen-Aktionen pro Key/Culture-Kombination

::: info Permission
Der Zugang zur Admin-Section erfordert die Permission `localization:translations:manage` (`LocalizationPermissions.TranslationsManage`).
:::

## Eigene Assembly-Prefixes hinzufügen

Sollen eigene Texte (z. B. `MyApp.Core.Resources`) ebenfalls im Translation-Editor erscheinen:

```csharp
builder.Services.Configure<LocalizationScanOptions>(options =>
{
    options.AdditionalAssemblyPrefixes.Add("MyApp.");
    options.SetDisplayName("MyApp", "Meine Anwendung");
});
```

Der Assembly-Scan sucht dann zusätzlich nach Embedded Resources, deren Basisname mit `MyApp.` beginnt.
