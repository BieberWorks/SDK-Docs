# SDK-UI — Components

## BwThemeProvider

`BwThemeProvider` is the root component for MudBlazor theming. It renders `MudThemeProvider`, `MudPopoverProvider`, `MudDialogProvider`, and `MudSnackbarProvider`, and wraps `BwViewport`.

```razor
<BwThemeProvider>
    @ChildContent
</BwThemeProvider>
```

**Internals:** The component injects `ILayoutThemeContext`, `IThemeService`, and `ILayoutThemeProvider`. On `OnChanged` events from both services, it rebuilds `MudTheme` from `ILayoutThemeProvider.GetThemeData(layoutKey, userId)` and calls `StateHasChanged`. The current user is obtained via `AuthenticationStateProvider`.

::: warning Uniqueness rule
`BwThemeProvider` must exist **once** in `Routes.razor` — never inside individual layouts. Multiple instances lead to competing theme states.
:::

## ILayoutThemeContext

Manages the current layout key (e.g. `"admin"`, `"account"`). Layouts call `Set(key)` during initialization. `BwThemeProvider` listens to `OnChanged` and switches the palette accordingly.

```csharp
public interface ILayoutThemeContext
{
    string? CurrentLayoutKey { get; }
    void Set(string? key);
    event Action<LayoutThemeChangedArgs>? OnChanged;
}
```

Layouts set the key in `OnInitialized`:

```razor
@inject ILayoutThemeContext LayoutContext

@code {
    protected override void OnInitialized()
    {
        LayoutContext.Set("admin");   // or "account", null for default
    }
}
```

## ILayoutThemeProvider

Provides `LayoutThemeData` (light and dark palette as `IReadOnlyDictionary<string, string?>` plus optional `LogoStorageKey`) for a layout key and user ID.

```csharp
public interface ILayoutThemeProvider
{
    LayoutThemeData GetThemeData(string? layoutKey, string? userId = null);
}
```

The default implementation `DefaultLayoutThemeProvider` returns `LayoutThemeData.Empty` (empty palettes). SDK-Theme overrides this registration via `TryAddScoped` with a database-backed implementation.

## IThemeService

Manages dark mode state per scoped session.

```csharp
public interface IThemeService
{
    bool IsDarkMode { get; }
    void ToggleDarkMode();
    event Action? OnThemeChanged;
}
```

## DarkModeToggle

Ready-made AppBar component without parameters. Injects `IThemeService`, subscribes to `OnThemeChanged`, and renders a `MudToggleIconButton` (sun / moon).

```razor
<DarkModeToggle />
```

::: tip Direct use in layouts
`AdminLayout` and `AccountLayout` do not use `DarkModeToggle` directly as a component, but set a `MudToggleIconButton` with the same bindings manually to get access to the localization tooltip. `DarkModeToggle` is for own layouts and shells.
:::

## LanguageSwitcher

Dropdown menu for culture switching. Injects `ILanguageService` (from SDK-Localization) and `NavigationManager`. Switches culture via `window.location.assign` to `/bw/set-culture` — no Blazor ForceLoad, no circuit cleanup bug.

```razor
<LanguageSwitcher />
```

**Responsive behavior:** Receives `BwViewportInfo` as `[CascadingParameter]` from `BwViewport`. On `xs`/`sm`, shows only the globe icon; from `md` up, also shows the native name of the current language.

::: warning Dependency
`LanguageSwitcher` requires `ILanguageService`, provided by `BieberWorks.SDK.Localization`. Without this module, the component is not usable.
:::

## IAppBarWidget

Contract for Blazor components that modules plug into the AppBar. Rendered via DI enumeration (`IEnumerable<IAppBarWidget>`) by `BwShellLayout` (sorted by `Order` property).

```csharp
public interface IAppBarWidget
{
    Type ComponentType { get; }  // Blazor ComponentBase without parameters
    int Order { get; }           // Sorting, lower values first
}
```

**Example — register widget in a domain module:**

```csharp
// In IModule.RegisterServices:
services.AddSingleton<IAppBarWidget>(new MyNotificationWidget());
```

```csharp
public sealed class MyNotificationWidget : IAppBarWidget
{
    public Type ComponentType => typeof(NotificationBellComponent);
    public int Order => 200;
}
```

The component `NotificationBellComponent` must be in an assembly that the host has included via `AddAdditionalAssemblies`.

## BwShellLayout

Shared responsive shell base for `AdminLayout` and `AccountLayout`. Not intended for direct use in own layouts — use via the ready-made shells.

Render slots:

| Parameter | Description |
|---|---|
| `AppBarColor` | `Color` enum for `MudAppBar` (default: `Color.Primary`) |
| `TitleContent` | Title area of the AppBar (visible from `sm` up, hidden on `xs`) |
| `AppBarContent` | Action area on the right in the AppBar (always visible) |
| `DrawerContent` | Contents of the `MudDrawer` |
| `BodyContent` | Main content (replaces `@Body`) |

## BwViewportInfo

Record with breakpoint snapshot, cascaded by `BwViewport`.

```csharp
public sealed record BwViewportInfo(bool IsXs, bool IsSmDown, bool IsMdUp);
```

Page components within `BwThemeProvider` (which contains `BwViewport`) can access it via `[CascadingParameter]`:

```razor
@code {
    [CascadingParameter]
    public BwViewportInfo? Viewport { get; set; }
}
```

## ICookieConsentService / CookieBanner

`ICookieConsentService` manages cookie consents per category (`Necessary`, `Functional`, `Analytics`, `Marketing`). Modules declare their cookies by implementing `ICookieRegistrationSource` (in `BieberWorks.SDK.UI.Contracts`).

```csharp
public interface ICookieConsentService
{
    bool IsConsentGiven(CookieCategory category);
    Task SetConsentAsync(IReadOnlyDictionary<CookieCategory, bool> choices);
    Task LoadConsentAsync();
    IReadOnlyList<CookieRegistration> GetRegistrations();
    event Action? OnConsentChanged;
}
```

`CookieBanner` is the associated UI component shown when consent is missing.

### Registering module cookies via ICookieRegistrationSource

Implement `ICookieRegistrationSource` and register it as a singleton enumerable:

```csharp
internal sealed class MyCookieRegistrationSource : ICookieRegistrationSource
{
    public IEnumerable<CookieRegistration> GetRegistrations()
    {
        yield return new CookieRegistration(
            Name: "my.cookie",
            Category: CookieCategory.Functional,
            Description: "Used for ...",
            Module: "MyModule"
        );
    }
}

// In IModule.RegisterServices / Program.cs:
services.TryAddEnumerable(
    ServiceDescriptor.Singleton<ICookieRegistrationSource, MyCookieRegistrationSource>());
```

`CookieConsentService` consumes `IEnumerable<ICookieRegistrationSource>` and deduplicates entries by `Name`.

::: warning Deprecated API
`CookieConsentServiceCollectionExtensions.RegisterCookies()` is marked `[Obsolete]`. Migrate to `ICookieRegistrationSource`. The method will be removed in the next major release.
:::

## IUserTimeZoneAccessor / BwTime

`IUserTimeZoneAccessor` (in `BieberWorks.SDK.UI.Contracts.TimeZone`) provides UTC/Local display mode switching and consistent timestamp formatting. One instance per Blazor circuit (Scoped).

```csharp
public interface IUserTimeZoneAccessor
{
    TimeZoneDisplayMode DisplayMode { get; }   // Utc (default) or Local
    string? BrowserTimeZone { get; }           // IANA zone, e.g. "Europe/Berlin"; null until JS resolved
    event Action? OnChanged;
    Task InitializeAsync();   // reads bw.tz cookie; idempotent
    Task SetLocalAsync();     // detects browser IANA zone via JS; persists bw.tz cookie
    Task SetUtcAsync();       // clears bw.tz cookie
    string Format(DateTimeOffset value);
}
```

**Formatting rules:**
- UTC mode: `"dd MMM yyyy HH:mm UTC"` (e.g. `"25 Jun 2026 14:30 UTC"`)
- Local mode: `"dd MMM yyyy HH:mm +02:00"` (offset notation; falls back to UTC if zone not yet resolved)

**`bw.tz` cookie:** classified as `Necessary` — no consent banner required. The cookie stores the IANA zone string and survives page reloads. Cleared when the user switches back to UTC.

### BwTime component

`BwTime` renders a single `DateTimeOffset` as a formatted string that reacts to mode changes. It is the recommended way to display timestamps in module pages.

```razor
<BwTime Value="@myTimestamp" />
```

The component calls `InitializeAsync()` in `OnInitializedAsync`, subscribes to `OnChanged`, and disposes the subscription cleanly.

### Toggling display mode

Inject `IUserTimeZoneAccessor` and call `SetLocalAsync()` / `SetUtcAsync()`:

```razor
@inject IUserTimeZoneAccessor TimeZoneAccessor

<MudToggleIconButton @bind-Toggled="_isLocal"
    Icon="@Icons.Material.Filled.AccessTime"
    ToggledIcon="@Icons.Material.Filled.Language"
    ToggledChanged="OnToggled" />

@code {
    private bool _isLocal;

    protected override async Task OnInitializedAsync()
    {
        await TimeZoneAccessor.InitializeAsync();
        _isLocal = TimeZoneAccessor.DisplayMode == TimeZoneDisplayMode.Local;
    }

    private async Task OnToggled(bool local)
    {
        if (local) await TimeZoneAccessor.SetLocalAsync();
        else       await TimeZoneAccessor.SetUtcAsync();
    }
}
```

## Component Override System

The override system allows a host to replace individual SDK pages or layouts with custom components, without creating route conflicts.

### Registration

All three extension methods delegate to the same `IComponentOverrideRegistry`:

```csharp
// Program.cs — replace an SDK page with a host-specific page
builder.Services.OverridePage(
    sdkType:  typeof(BieberWorks.SDK.Localization.UI.MudBlazor.Pages.Admin.TranslationEditorPage),
    hostType: typeof(MyApp.Pages.Admin.CustomTranslationPage));

// Replace a layout
builder.Services.OverrideLayout(
    sdkType:  typeof(SomeSdkLayout),
    hostType: typeof(MyCustomLayout));

// Replace a non-page component
builder.Services.OverrideComponent(
    sdkType:  typeof(SomeSdkComponent),
    hostType: typeof(MyCustomComponent));
```

### Host Component Requirements

The replacement component (`hostType`) must **not** have a `@page` directive. `BwRouter` resolves the route to the SDK type and then swaps it for the host type at render time. If the host component also declares `@page`, both routes exist and the SDK route is not suppressed.

### BwRouter vs. Standard Router

Use `BwRouter` (from `BieberWorks.SDK.UI.MudBlazor.Routing`) instead of the standard Blazor `Router` component when:

- The host has pages that share the same route as SDK module pages (the host's `@page` should always win), or
- Any `OverridePage` / `OverrideLayout` / `OverrideComponent` registrations are used.

`BwRouter` consults the `IComponentOverrideRegistry` on every navigation and replaces the resolved component type before rendering. The standard Blazor `Router` ignores the registry.

If none of these conditions apply and you have no route conflicts, the standard `Router` works without issues.

### Host-Assembly Priority

`AddBieberWorksRouting(typeof(Program).Assembly)` registers the host assembly with priority 1000. When `BwRouter` encounters two `@page` directives for the same path — one in the host, one in an SDK module — the host page wins. This is the alternative to `OverridePage` for cases where the host component does declare `@page`.

### Limitations

- **One override per SDK type.** If `OverridePage` is called twice with the same `sdkType`, the second call wins. There is no stacking or chaining.
- **Resolved at router level, not at render time.** The swap happens when `BwRouter` selects the component to render, not inside the component tree. Re-registration after the application has started has no effect on running circuits.
- **Assembly must be registered.** The `hostType` component's assembly must be discoverable by the Blazor component system. If using `AddBwModuleAssemblies`, SDK assemblies are auto-discovered. Host assemblies are included via `typeof(Program).Assembly` in `MapRazorComponents<App>()`. Custom RCL assemblies need explicit inclusion.

### Alternative: @page in Host Component

Instead of `OverridePage`, you can declare `@page "/admin/settings"` directly in a host component. `BwRouter` sees the host assembly's route first (higher priority via `AddBieberWorksRouting`) and never reaches the SDK page. The SDK component is not rendered and its DI dependencies are not resolved.

This approach is simpler but requires a `@page` directive on the host component.


## BwDataView\<TItem\>

Declarative responsive data component. Desktop (md+) renders a `MudDataGrid`; mobile (xs/sm) renders a `MudCard` list with a bottom-sheet filter drawer and sort menu. Both views are driven by the same `IReadOnlyList<BwColumn<TItem>>` — no duplication between desktop and mobile.

### Column descriptor

```csharp
new BwColumn<MyDto>
{
    Title          = "Email",
    PropertyName   = nameof(MyDto.Email),   // for grid sort
    Value          = d => d.Email,           // text fallback
    CellContent    = d => @<MudLink Href="...">@d.Email</MudLink>,  // desktop cell
    CardFieldContent = d => @<span>@d.Email</span>,                  // mobile card field (optional)
    IsCardTitle    = true,
    Sortable       = true,
    FilterType     = BwFilterType.Text,
    FilterDebounce = 400,
    GetFilterValue = () => _emailFilter,
    OnFilterChanged = async v => { _emailFilter = v as string; await ReloadAsync(); },
}
```

### BwFilterType values

| Value | Mobile drawer control |
|---|---|
| `None` | No filter |
| `Text` | Debounced `MudTextField` |
| `Select` | `MudSelect` single-value |
| `Multiselect` | Scrollable `MudCheckBox` list (from `FilterOptions`) |
| `DateRange` | From / To `MudDatePicker` pair |
| `Tree` | Caller-supplied `FilterTreeContent` RenderFragment |

### Component parameters

| Parameter | Type | Notes |
|---|---|---|
| `Columns` | `IReadOnlyList<BwColumn<TItem>>` | Required |
| `Items` | `IEnumerable<TItem>?` | In-memory (mutually exclusive with `ServerData`) |
| `ServerData` | `Func<GridState<TItem>, CancellationToken, Task<GridData<TItem>>>?` | Server-side paging |
| `ToolbarContent` | `RenderFragment?` | Rendered above the data on both viewports |
| `NoRecordsContent` | `RenderFragment?` | Empty-state slot |
| `RowActions` | `RenderFragment<TItem>?` | Last column (desktop) / card footer (mobile) |
| `RowsPerPage` | `int` | Default 25 |
| `PageSizeOptions` | `int[]?` | Default `[10, 25, 50, 100]` |
| `GridRef` / `GridRefChanged` | `MudDataGrid<TItem>?` | Two-way binding to expose internal grid |

### Calling ReloadAsync

```csharp
private BwDataView<MyDto>? _dataView;
// ...
await _dataView!.ReloadAsync(); // reloads correct viewport automatically
```

### CSS

Include `_content/BieberWorks.SDK.UI.MudBlazor/css/bw-dataview.css` in the host's `<head>` (or via `app.css` import). This file is served as a static web asset automatically when the NuGet package is referenced.
