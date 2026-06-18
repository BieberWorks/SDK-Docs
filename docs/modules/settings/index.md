# SDK-Settings

Das Modul **BieberWorks.SDK.Settings** bietet datenbankgestützte Anwendungseinstellungen mit `IMemoryCache`-Schicht. Settings werden einmal definiert (`AppSettingDefinition`), beim Modulstart idempotent in die Datenbank geseeded und danach per `ISettingsService` synchron auf dem Hot Path gelesen.

## Pakete

| NuGet-Paket | Inhalt | Referenzieren |
|---|---|---|
| `BieberWorks.SDK.Settings.Contracts` | `ISettingsService`, `IFeatureFlagService`, `ISettingsAdminService`, `AppSettingDefinition`, `AppSettingDto`, `AppSettingType`, Events, Permissions | andere Module |
| `BieberWorks.SDK.Settings` | `SettingsModule`, `CachedSettingsStore`, `SettingsAdminService`, `FeatureFlagService`, `SettingsDbContext` (Schema `settings`) | Host |
| `BieberWorks.SDK.Settings.UI` | `AppSettingsPageBase`, `FeatureFlagsPageBase` (MudBlazor-unabhängige Basisklassen) | Host mit UI |
| `BieberWorks.SDK.Settings.UI.MudBlazor` | MudBlazor-Rendering, `AddSettingsUi()` | Host mit MudBlazor |

**Aktuelle Version:** `v0.0.1`

## Wann Settings statt appsettings.json?

| Kriterium | `appsettings.json` | SDK-Settings |
|---|---|---|
| Wert zur Laufzeit veranderbar | Nein | Ja |
| Kein Deployment nötig | Nein | Ja |
| Passwörter / Secrets | Ja (User Secrets / Vault) | Nein |
| Infrastruktur-Konfiguration (Ports, DB-URLs) | Ja | Nein |
| App-Verhalten, Feature-Flags, Texte | Nein | Ja |

::: warning Keine Secrets in SDK-Settings speichern
SDK-Settings ist für veränderliche App-Konfiguration gedacht, nicht für Credentials oder Verbindungsstrings. Secrets gehören in Environment Variables oder einen Secret Manager.
:::

## Datenmodell

Jede Setting hat eine **Definition** (Key, Section, Typ, Beschreibung, Standardwert) und optional einen **Value** (gesetzter Wert, LastModifiedAt, LastModifiedBy).

`GetValue` gibt `Value.Value ?? Definition.DefaultValue ?? übergebe defaultValue` zurück.

## AppSettingType

| Wert | Bedeutung | UI-Darstellung |
|---|---|---|
| `String` (0) | Freitext | Textfeld |
| `Boolean` (1) | true/false | Toggle |
| `Integer` (2) | Ganzzahl | Zahlenfeld |
| `Json` (3) | JSON-Blob | Mehrzeiliger Editor |

## Feature-Flags

`IFeatureFlagService` ist eine schlanke Facade über `ISettingsService`. Keys folgen der Konvention `feature:<featureKey>`. Truthy-Werte: `true`, `1`, `yes` (case-insensitive).

## Auto-Auditing

Beide Domain-Events des Moduls implementieren `IAuditableEvent`:

| Event | Trigger | AuditAction |
|---|---|---|
| `SettingChangedEvent` | Wert gesetzt | `settings:value:changed` |
| `SettingResetEvent` | Wert zurückgesetzt | `settings:value:reset` |

SDK-Audit erfasst diese Events automatisch über den Open-Generic-Handler — kein zusätzlicher Code nötig.

## Permissions

| Konstante | Wert | Bedeutung |
|---|---|---|
| `SettingsPermissions.SettingsRead` | `settings:settings:read` | Admin-UI lesen |
| `SettingsPermissions.SettingsManage` | `settings:settings:manage` | Werte ändern / zurücksetzen |
