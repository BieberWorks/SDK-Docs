# Account Navigation

The Account shell navigation is driven by `IAccountSection` registrations and an admin-managed
override layer. `IAccountSection` (in `Account.Contracts`) is an empty marker interface over
`BieberWorks.SDK.Shell.Contracts.IShellSection` — all navigation machinery (resolve pipeline,
override store, editor) is implemented once, generically, in the standalone **SDK-Shell**
module and shared with the Admin shell (and any future shell). The layout never iterates
`IEnumerable<IAccountSection>` directly; all rendering goes through
`IShellNavigationService<IAccountSection>`.

---

## `IAccountSection.Key`

Every `IAccountSection` implementation provides a `Key` property (inherited from `IShellSection`):

```csharp
public string Key => "storage"; // stable, lower-kebab-case, globally unique
```

The key is used as the persistence key in the override store and for deduplication.
Chosen values must be unique across all registered modules and must never change after
first deployment (changing a key loses any admin-configured overrides for that section).

---

## `IShellNavigationService<IAccountSection>`

Located in `BieberWorks.SDK.Shell.Contracts.Navigation`, generic over the shell marker type.
The Account shell registers it via `AddBwShell<IAccountSection>(...)` inside
`AddBieberWorksAccount()`:

```csharp
public interface IShellNavigationService<TMarker> where TMarker : IShellSection
{
    IReadOnlyList<ResolvedShellSection> GetResolvedNav(IServiceProvider services);
    ShellNavOverrideStore GetStore();
    Task SaveStoreAsync(ShellNavOverrideStore store);
}
```

`GetResolvedNav` applies the persisted override store on top of the code-registered sections and
returns a sorted, deduped list of `ResolvedShellSection` records. `AccountLayout` uses this
exclusively.

---

## Settings Key

The override store is persisted as JSON under the settings key **`account.nav.overrides`**
(derived from the shell's `Key`, `"account"`, via `ShellDefinition`), via SDK-Settings.
An empty or missing value is treated as no overrides (code defaults).

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

## `ResolvedShellSection`

```csharp
public sealed record ResolvedShellSection(
    string Key,
    string Title,
    string Icon,
    int Order,
    bool IsHidden,
    bool IsAdminCreated,
    string? RequiredPermission,
    IReadOnlyList<ResolvedShellNavItem> Items);
```

`RequiredPermission` is carried through the resolve pipeline unchanged from the original
`IAccountSection.RequiredPermission` (inherited from `IShellSection.RequiredPermission`).
`AccountLayout` (via `BwShellLayoutBase<IAccountSection>`) wraps permission-gated sections
in `<AuthorizeView Policy="perm:{RequiredPermission}">`.

---

## Admin Navigation Override Editor

The Account shell's `IShellNavigationService<IAccountSection>` is additionally exposed as
`INavOverrideTarget` (registered automatically by `AddBwShell<IAccountSection>()`, from
`BieberWorks.SDK.Shell.Contracts.Navigation`). The generic `BwShellNavEditor` component,
hosted by SDK-Admin at `/admin/navigation`, discovers it automatically and renders an
"Account" tab alongside the "Admin" tab. No changes to `Admin.UI.Blazor.MudBlazor` or
`Shell.UI.Blazor.MudBlazor` are needed when the Account module is added to a host.

---

## Resolve Pipeline (order of operations)

1. Collect all `IAccountSection` instances where `IsEnabled(services)` is `true`.
2. Deduplicate by `Key` (first-wins; duplicate keys emit a warning log).
3. Build default Href→section-key map.
4. Apply `ItemOverrides` (redirect items to other sections).
5. Apply `SectionOverrides` (title, icon, order, hidden).
6. Append `AdminCreatedSections` (no `RequiredPermission`).
7. Sort by effective `Order`.

For the full JSON schema, override semantics, and editor capabilities, see the SDK-Shell
module's navigation documentation (shared kernel) and SDK-Admin's `11-navigation.md`
(Admin-flavored write-up of the same mechanism).

## Anonymous access

`AccountLayout` sets `RequireAuthenticatedUser="true"` on `BwShellLayoutBase<IAccountSection>`. Anonymous users
(including clicks inside an interactive circuit that never pass the HTTP pipeline) are redirected to the login
page via `BwRedirectToLogin` and see neither the drawer nor the navigation. Requires SDK-Shell 1.1.0 or later.
