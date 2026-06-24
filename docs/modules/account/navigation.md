# Account Navigation

The Account shell navigation is driven by `IAccountSection` registrations and an admin-managed
override layer. From v1.0.0 the layout no longer iterates `IEnumerable<IAccountSection>` directly;
all rendering goes through `IAccountNavigationService`.

---

## `IAccountSection.Key` (v1.0.0 — breaking)

Every `IAccountSection` implementation must now provide a `Key` property:

```csharp
public string Key => "storage"; // stable, lower-kebab-case, globally unique
```

The key is used as the persistence key in the override store and for deduplication.
Chosen values must be unique across all registered modules and must never change after
first deployment (changing a key loses any admin-configured overrides for that section).

---

## `IAccountNavigationService`

Located in `BieberWorks.SDK.Account.Contracts.Navigation`.

```csharp
public interface IAccountNavigationService
{
    IReadOnlyList<ResolvedAccountSection> GetResolvedNav(IServiceProvider services);
    AccountNavOverrideStore GetStore();
    Task SaveStoreAsync(AccountNavOverrideStore store);
}
```

`GetResolvedNav` applies the persisted override store on top of the code-registered sections and
returns a sorted, deduped list of `ResolvedAccountSection` records. The `AccountLayout` uses this
exclusively from v1.0.0 onwards.

---

## Settings Key

The override store is persisted as JSON under the settings key **`account.nav.overrides`**
via `ISettingsAdminService`. An empty or missing value is treated as no overrides (code defaults).

### JSON schema

```json
{
  "version": 1,
  "sectionOverrides": [
    { "key": "storage", "displayTitle": "My Files", "order": 5, "isHidden": false }
  ],
  "itemOverrides": [
    { "href": "/account/files", "targetSectionKey": "auth", "order": 1 }
  ],
  "adminCreatedSections": [
    { "key": "custom", "displayTitle": "Custom", "displayIcon": "Icons...", "order": 99, "isHidden": false }
  ]
}
```

---

## `ResolvedAccountSection`

```csharp
public sealed record ResolvedAccountSection(
    string Key,
    string Title,
    string Icon,
    int Order,
    bool IsHidden,
    bool IsAdminCreated,
    string? RequiredPermission,
    IReadOnlyList<ResolvedAccountNavItem> Items);
```

`RequiredPermission` is carried through the resolve pipeline unchanged from the original
`IAccountSection.RequiredPermission`. The `AccountLayout` still wraps permission-gated sections
in `<AuthorizeView Policy="perm:{RequiredPermission}">`.

---

## Admin Navigation Override Editor

`AccountNavigationService` implements `INavOverrideTarget` (from `BieberWorks.SDK.Admin.Contracts`)
and registers itself as such. The Admin editor at `/admin/navigation` discovers it automatically
and renders an "Account" tab alongside the "Admin" tab. No changes to `Admin.UI.MudBlazor` are
needed when the Account module is added to a host.

---

## Resolve Pipeline (order of operations)

1. Collect all `IAccountSection` instances where `IsEnabled(services)` is `true`.
2. Deduplicate by `Key` (first-wins; duplicate keys emit a warning log).
3. Build default Href→section-key map.
4. Apply `ItemOverrides` (redirect items to other sections).
5. Apply `SectionOverrides` (title, icon, order, hidden).
6. Append `AdminCreatedSections` (no RequiredPermission).
7. Sort by effective `Order`.
