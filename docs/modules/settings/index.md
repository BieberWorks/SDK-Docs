# SDK-Settings

The module **BieberWorks.SDK.Settings** provides database-backed application settings with `IMemoryCache` layer. Settings are defined once (`AppSettingDefinition`), seeded idempotently into the database on module startup, and then read synchronously via `ISettingsService` on the hot path.

## Packages

| NuGet package | Contents | Reference |
|---|---|---|
| `BieberWorks.SDK.Settings.Contracts` | `ISettingsService`, `IFeatureFlagService`, `ISettingsAdminService`, `AppSettingDefinition`, `AppSettingDto`, `AppSettingType`, events, permissions | other modules |
| `BieberWorks.SDK.Settings` | `SettingsModule`, `CachedSettingsStore`, `SettingsAdminService`, `FeatureFlagService`, `SettingsDbContext` (schema `settings`) | host |
| `BieberWorks.SDK.Settings.UI` | `AppSettingsPageBase`, `FeatureFlagsPageBase` (MudBlazor-independent base classes) | host with UI |
| `BieberWorks.SDK.Settings.UI.MudBlazor` | MudBlazor rendering, `AddSettingsUi()` | host with MudBlazor |

For the current release version see the [GitHub Releases page](https://github.com/BieberWorks/SDK-Settings/releases).

## When to use settings vs. appsettings.json?

| Criterion | `appsettings.json` | SDK-Settings |
|---|---|---|
| Value changeable at runtime | No | Yes |
| No deployment required | No | Yes |
| Passwords / secrets | Yes (User Secrets / Vault) | No |
| Infrastructure config (ports, DB URLs) | Yes | No |
| App behavior, feature flags, texts | No | Yes |

::: warning No secrets in SDK-Settings
SDK-Settings is for changeable app configuration, not credentials or connection strings. Secrets belong in environment variables or a secret manager.
:::

## Data model

Each setting has a **definition** (key, section, type, description, default value) and optionally a **value** (set value, LastModifiedAt, LastModifiedBy).

`GetValue` returns `Value.Value ?? Definition.DefaultValue ?? passed defaultValue`.

## AppSettingType

| Value | Meaning | UI display |
|---|---|---|
| `String` (0) | Free text | Text field |
| `Boolean` (1) | true/false | Toggle |
| `Integer` (2) | Whole number | Number field |
| `Json` (3) | JSON blob | Multi-line editor |

## Feature flags

`IFeatureFlagService` is a thin facade over `ISettingsService`. Keys follow the convention `feature:<featureKey>`. Truthy values: `true`, `1`, `yes` (case-insensitive).

## Auto-Auditing

Both domain events of the module implement `IAuditableEvent`:

| Event | Trigger | AuditAction |
|---|---|---|
| `SettingChangedEvent` | Value set | `settings:value:changed` |
| `SettingResetEvent` | Value reset | `settings:value:reset` |

SDK-Audit captures these events automatically via the open-generic handler — no additional code needed.

## Permissions

| Constant | Value | Meaning |
|---|---|---|
| `SettingsPermissions.SettingsRead` | `settings:settings:read` | Read admin UI |
| `SettingsPermissions.SettingsManage` | `settings:settings:manage` | Change / reset values |

## Documentation

| Topic | File |
|---|---|
| Setup & registration | [setup.md](setup.md) |
| Runtime usage (ISettingsService, IFeatureFlagService, ISettingsAdminService, cache) | [usage.md](usage.md) |
| Changelog | [CHANGES.md](CHANGES.md) |
