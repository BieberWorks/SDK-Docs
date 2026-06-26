# SDK-Localization

The module **BieberWorks.SDK.Localization** extends Foundation's localization with a database-backed override layer: texts delivered via `.resx` files in modules can be overridden at runtime per language via the admin UI — without deployment.

## Packages

| NuGet Package | Content | Reference |
|---|---|---|
| `BieberWorks.SDK.Localization.Contracts` | `ITranslationAdminService`, `TranslationKeyView`, `ModuleInfo`, `LocalizationScanOptions`, Permissions | other modules (contracts only) |
| `BieberWorks.SDK.Localization` | `LocalizationModule`, `CachedTranslationStore`, `TranslationAdminService`, `LocalizationDbContext` (schema `localization`) | Host |
| `BieberWorks.SDK.Localization.UI` | `TranslationEditorPageBase` (MudBlazor-independent base classes) | Host with UI |
| `BieberWorks.SDK.Localization.UI.MudBlazor` | MudBlazor rendering, `AddLocalizationUi()` | Host with MudBlazor |

For the current release version see the [GitHub Releases page](https://github.com/BieberWorks/SDK-Localization/releases).

## Layering Model

```
IStringLocalizer<T>
        │
        ▼
LayeredStringLocalizer  (Foundation)
   ├── ITranslationStore.TryGet(module, key, culture)   ← DB override  (Singleton, IMemoryCache)
   │        └── CachedTranslationStore  (this module)
   │                 └── LocalizationDbContext → PostgreSQL schema "localization"
   └── .resx fallback  (satellite assemblies)
```

The layering order is fixed: DB override takes precedence over `.resx`. If no override exists, `.resx` is used. If no `.resx` entry exists either, the localizer returns the key itself.

## Key Discovery via Assembly Scan

`TranslationAdminService` scans all loaded assemblies on first call for embedded `.resources` streams whose name starts with `BieberWorks.SDK.`. The prefix is configurable via `LocalizationScanOptions.AdditionalAssemblyPrefixes` if own assemblies should be included.

The module name is derived from the resource base name after stripping the prefix, e.g.:
- `BieberWorks.SDK.Auth.Resources` → Module **Auth**
- `BieberWorks.SDK.Localization.UI.Resources` → Module **Localization**

> **No domain module changes required.** A module only needs to deliver its `.resx` files. SDK-Localization discovers them automatically — no separate registration call in the domain module.

## Cache Behavior

`CachedTranslationStore` holds overrides per `(module, culture)` pair in `IMemoryCache`:

| Parameter | Value |
|---|---|
| Absolute Expiry | 30 minutes |
| Sliding Expiry | 5 minutes |
| Invalidation | immediately after every `SetOverrideAsync` / `ClearOverrideAsync` |

The lookup happens synchronously on the hot path (every label render). With culture fallback, `de-DE` is searched first, then `de`.

## Permissions

| Constant | Value | Meaning |
|---|---|---|
| `LocalizationPermissions.TranslationsManage` | `localization:translations:manage` | Display and edit overrides |

## Documentation

| Topic | Description |
|---|---|
| [Setup](setup.md) | NuGet installation, `Program.cs` wiring, assembly registration, connection string, migrations |
| [Usage](usage.md) | Creating `.resx` files, `IStringLocalizer`, language switch, programmatic API, admin UI, adding languages |
| [Changelog](CHANGES.md) | Auto-generated release notes |
