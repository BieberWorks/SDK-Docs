# Verwendung — SDK-Settings

## ISettingsService

`ISettingsService` ist als Singleton registriert. `GetValue` und `IsEnabled` sind synchron — kein `await` nötig.

```csharp
using BieberWorks.SDK.Settings.Contracts;

public class MyService(ISettingsService settings)
{
    public int GetItemsPerPage()
    {
        var raw = settings.GetValue("ui:items-per-page", defaultValue: "25");
        return int.TryParse(raw, out var n) ? n : 25;
    }

    public bool IsMaintenanceModeOn()
        => settings.IsEnabled("feature:maintenance", defaultValue: false);
}
```

### GetValue

```csharp
string? value = settings.GetValue("my:key");
string value  = settings.GetValue("my:key", defaultValue: "fallback")!;
```

Reihenfolge der Wert-Auflösung: gesetzter DB-Wert → `DefaultValue` der Definition → übergebener `defaultValue`-Parameter.

### IsEnabled

Wertet den Wert als Boolean aus. Truthy-Werte: `true`, `1`, `yes` (Groß-/Kleinschreibung irrelevant).

```csharp
bool active = settings.IsEnabled("feature:my-feature");
```

### GetSectionAsync / GetAllAsync

Liefert alle Settings einer Section bzw. alle Settings als `IReadOnlyList<AppSettingDto>`. Ergebnis wird gecacht.

```csharp
IReadOnlyList<AppSettingDto> uiSettings = await settings.GetSectionAsync("ui");
IReadOnlyList<AppSettingDto> all        = await settings.GetAllAsync();
```

`AppSettingDto` enthält:

| Property | Typ | Bedeutung |
|---|---|---|
| `Key` | `string` | Setting-Key |
| `Value` | `string?` | Aktuell gesetzter Wert (null = nicht gesetzt) |
| `DefaultValue` | `string?` | Standardwert aus der Definition |
| `Section` | `string` | Gruppierung |
| `Description` | `string?` | Beschreibungstext |
| `Type` | `AppSettingType` | String / Boolean / Integer / Json |
| `LastModifiedAt` | `DateTimeOffset?` | Letzter Änderungszeitpunkt |
| `LastModifiedBy` | `string?` | Benutzername des letzten Änderers |

## IFeatureFlagService

`IFeatureFlagService` ist eine schlanke Facade. Der übergebene `featureKey` wird intern als `feature:<featureKey>` in den Settings nachgeschlagen.

```csharp
using BieberWorks.SDK.Settings.Contracts;

public class MyFeature(IFeatureFlagService features)
{
    public bool ShowNewDashboard => features.IsEnabled("new-dashboard");
    // liest intern: settings.IsEnabled("feature:new-dashboard")
}
```

::: tip Feature-Flag-Konvention
Definiere Feature-Flags mit dem Key-Prefix `feature:` und Section `features`:
```csharp
new AppSettingDefinition("feature:new-dashboard", "features", AppSettingType.Boolean, "false")
```
:::

## ISettingsAdminService

Für programmatische Schreiboperationen (z. B. in Integrationstests oder Seedern):

```csharp
using BieberWorks.SDK.Settings.Contracts;

public class Seeder(ISettingsAdminService admin)
{
    public async Task SeedAsync()
    {
        // Wert setzen
        await admin.SetValueAsync("ui:items-per-page", "50", modifiedBy: "seed");

        // Wert auf Standardwert zurücksetzen
        await admin.ResetToDefaultAsync("ui:items-per-page");

        // Setting vollständig löschen
        await admin.DeleteAsync("obsolete:key");
    }
}
```

Nach jedem Schreibvorgang wird der Cache automatisch invalidiert.

## Cache-Verhalten

`CachedSettingsStore` hält Settings in zwei Cache-Entries:

| Cache-Key | Inhalt | Invalidierung |
|---|---|---|
| `bw-settings:_all_dict` | Alle Settings als Dictionary (Hot Path für `GetValue`) | bei jeder Änderung |
| `bw-settings:_all` | Alle Settings als Liste | bei jeder Änderung |
| `bw-settings:<section>` | Settings einer Section | bei Änderung in dieser Section |

Ablaufzeiten: Absolute 30 Minuten, Sliding 5 Minuten.

## Admin-UI

Das Modul registriert zwei Admin-Seiten im Admin-Shell:

| Seite | Pfad | Inhalt |
|---|---|---|
| App Settings | `/admin/settings` | CRUD für alle registrierten Settings |
| Feature Flags | `/admin/settings/features` | Gefilterte Ansicht der Section `features` als Toggle-Liste |

::: info Permission
- Lesen: `settings:settings:read` (`SettingsPermissions.SettingsRead`)
- Schreiben: `settings:settings:manage` (`SettingsPermissions.SettingsManage`)
:::

## Auto-Auditing

Wenn SDK-Audit installiert ist, werden Änderungen automatisch protokolliert. Es ist kein zusätzlicher Code nötig — `SettingChangedEvent` und `SettingResetEvent` implementieren `IAuditableEvent`.

```
Admin ändert Setting
  → ISettingsAdminService.SetValueAsync
      → SettingChangedEvent wird via IDomainEventPublisher publiziert
          → AuditableEventHandler<SettingChangedEvent> (SDK-Audit, Open-Generic)
              → IAuditService.LogAsync (Audit-DB)
```
