# Usage — SDK-Settings

## ISettingsService

`ISettingsService` is registered as a singleton. `GetValue` and `IsEnabled` are synchronous — no `await` needed.

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

Value resolution order: set DB value → `DefaultValue` of definition → passed `defaultValue` parameter.

### IsEnabled

Evaluates the value as a boolean. Truthy values: `true`, `1`, `yes` (case-insensitive).

```csharp
bool active = settings.IsEnabled("feature:my-feature");
```

### GetSectionAsync / GetAllAsync

Returns all settings of a section or all settings as `IReadOnlyList<AppSettingDto>`. Result is cached.

```csharp
IReadOnlyList<AppSettingDto> uiSettings = await settings.GetSectionAsync("ui");
IReadOnlyList<AppSettingDto> all        = await settings.GetAllAsync();
```

`AppSettingDto` contains:

| Property | Type | Meaning |
|---|---|---|
| `Key` | `string` | Setting key |
| `Value` | `string?` | Currently set value (null = not set) |
| `DefaultValue` | `string?` | Default from definition |
| `Section` | `string` | Grouping |
| `Description` | `string?` | Description text |
| `Type` | `AppSettingType` | String / Boolean / Integer / Json |
| `LastModifiedAt` | `DateTimeOffset?` | Last modification time |
| `LastModifiedBy` | `string?` | Username of last modifier |

## IFeatureFlagService

`IFeatureFlagService` is a thin facade. The passed `featureKey` is internally looked up as `feature:<featureKey>` in settings.

```csharp
using BieberWorks.SDK.Settings.Contracts;

public class MyFeature(IFeatureFlagService features)
{
    public bool ShowNewDashboard => features.IsEnabled("new-dashboard");
    // reads internally: settings.IsEnabled("feature:new-dashboard")
}
```

::: tip Feature flag convention
Define feature flags with key prefix `feature:` and section `features`:
```csharp
new AppSettingDefinition("feature:new-dashboard", "features", AppSettingType.Boolean, "false")
```
:::

## ISettingsAdminService

For programmatic write operations (e.g. in integration tests or seeders):

```csharp
using BieberWorks.SDK.Settings.Contracts;

public class Seeder(ISettingsAdminService admin)
{
    public async Task SeedAsync()
    {
        // Set value
        await admin.SetValueAsync("ui:items-per-page", "50", modifiedBy: "seed");

        // Reset to default
        await admin.ResetToDefaultAsync("ui:items-per-page");

        // Delete setting completely
        await admin.DeleteAsync("obsolete:key");
    }
}
```

The cache is automatically invalidated after each write operation.

## Cache behavior

`CachedSettingsStore` maintains settings in two cache entries:

| Cache key | Contents | Invalidation |
|---|---|---|
| `bw-settings:_all_dict` | All settings as dictionary (hot path for `GetValue`) | on every change |
| `bw-settings:_all` | All settings as list | on every change |
| `bw-settings:<section>` | Settings of one section | on change in that section |

Expiration times: absolute 30 minutes, sliding 5 minutes.

## Admin UI

The module registers two admin pages in the admin shell:

| Page | Path | Contents |
|---|---|---|
| App Settings | `/admin/settings` | CRUD for all registered settings |
| Feature Flags | `/admin/settings/features` | Filtered view of section `features` as toggle list |

::: info Permission
- Read: `settings:settings:read` (`SettingsPermissions.SettingsRead`)
- Write: `settings:settings:manage` (`SettingsPermissions.SettingsManage`)
:::

## Auto-Auditing

If SDK-Audit is installed, changes are automatically logged. No additional code needed — `SettingChangedEvent` and `SettingResetEvent` implement `IAuditableEvent`.

```
Admin changes setting
  → ISettingsAdminService.SetValueAsync
      → SettingChangedEvent is published via IDomainEventPublisher
          → AuditableEventHandler<SettingChangedEvent> (SDK-Audit, open-generic)
              → IAuditService.LogAsync (audit DB)
```
