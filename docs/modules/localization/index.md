# SDK-Localization

Das Modul **BieberWorks.SDK.Localization** erweitert die Foundation-Lokalisierung um eine datenbankgestützte Override-Schicht: Texte, die per `.resx`-Datei in Modulen ausgeliefert werden, können zur Laufzeit über die Admin-UI pro Sprache überschrieben werden — ohne Deployment.

## Pakete

| NuGet-Paket | Inhalt | Referenzieren |
|---|---|---|
| `BieberWorks.SDK.Localization.Contracts` | `ITranslationAdminService`, `TranslationKeyView`, `LocalizationScanOptions`, `ModuleInfo`, Permissions | andere Module (nur Contracts) |
| `BieberWorks.SDK.Localization` | `LocalizationModule`, `CachedTranslationStore`, `TranslationAdminService`, `LocalizationDbContext` (Schema `localization`) | Host |
| `BieberWorks.SDK.Localization.UI` | `TranslationEditorPageBase` (MudBlazor-unabhängige Basisklassen) | Host mit UI |
| `BieberWorks.SDK.Localization.UI.MudBlazor` | MudBlazor-Rendering, `AddLocalizationUi()` | Host mit MudBlazor |

**Aktuelle Version:** `v0.0.2`

## Schichtmodell

```
IStringLocalizer<T>
        │
        ▼
LayeredStringLocalizer  (Foundation)
   ├── ITranslationStore.TryGet(module, key, culture)   ← DB-Override  (Singleton, IMemoryCache)
   │        └── CachedTranslationStore  (dieses Modul)
   │                 └── LocalizationDbContext → PostgreSQL Schema "localization"
   └── .resx-Fallback  (satellite assemblies)
```

Die Schichtreihenfolge ist fest: DB-Override hat Vorrang vor `.resx`. Existiert kein Override, greift `.resx`. Existiert auch kein `.resx`-Eintrag, gibt der Localizer den Key selbst zurück.

## Key-Discovery via Assembly-Scan

`TranslationAdminService` scannt beim ersten Aufruf alle geladenen Assemblies nach embedded `.resources`-Streams, deren Name mit `BieberWorks.SDK.` beginnt. Das Präfix ist konfigurierbar über `LocalizationScanOptions.AdditionalAssemblyPrefixes`, wenn eigene Assemblies einbezogen werden sollen.

Aus dem Resource-Basisnamen wird der Modulname abgeleitet, z. B.:
- `BieberWorks.SDK.Auth.Resources` → Modul **Auth**
- `BieberWorks.SDK.Localization.UI.Resources` → Modul **Localization**

::: info Keine Fachmodul-Anpassung nötig
Ein Modul muss nur seine `.resx`-Dateien mitliefern. SDK-Localization entdeckt sie automatisch — kein separater Registrierungsaufruf im Fachmodul.
:::

## Cache-Verhalten

`CachedTranslationStore` hält Overrides pro `(module, culture)`-Paar im `IMemoryCache`:

| Parameter | Wert |
|---|---|
| Absolute Expiry | 30 Minuten |
| Sliding Expiry | 5 Minuten |
| Invalidierung | sofort nach jedem `SetOverrideAsync` / `ClearOverrideAsync` |

Der Lookup erfolgt synchron auf dem Hot Path (jeder Label-Render). Bei Culture-Fallback wird zuerst `de-DE` gesucht, dann `de`.

## Permissions

| Konstante | Wert | Bedeutung |
|---|---|---|
| `LocalizationPermissions.TranslationsManage` | `localization:translations:manage` | Overrides anzeigen und bearbeiten |
