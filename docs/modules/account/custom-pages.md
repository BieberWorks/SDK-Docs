# SDK-Account — Custom account pages

Other modules plug custom self-service pages into the account area by implementing `IAccountSection` and marking pages with `IAccountPage`.

## IAccountPage

Marker interface for routable Blazor pages in the account area.

```csharp
public interface IAccountPage;
```

This interface allows tools or filters to identify all account pages in an assembly. It has no required members.

## IAccountSection

Groups multiple `AccountNavItem` links under a drawer entry.

```csharp
public interface IAccountSection
{
    string Key   { get; }  // stable, lower-kebab-case, globally unique
    string Title { get; }
    string Icon  { get; }
    int    Order { get; }
    IReadOnlyList<AccountNavItem> NavItems { get; }

    // Optional: permission key (null = always visible)
    string? RequiredPermission => null;

    // Optional: hide section at runtime
    bool IsEnabled(IServiceProvider services) => true;
}
```

| Member | Description |
|---|---|
| `Key` | Stable, lower-kebab-case identifier (e.g. `"storage"`). Used as the persistence key for nav overrides. Must be unique across all modules and must never change after first deployment. |
| `Title` | Display name in the drawer (e.g. `"My Files"`) |
| `Icon` | MudBlazor icon constant (e.g. `Icons.Material.Filled.Folder`) |
| `Order` | Sorting; lower values appear higher |
| `NavItems` | List of navigation links in this section |
| `RequiredPermission` | Optional permission key in format `{module}:{resource}:{action}`; `null` = always visible |
| `IsEnabled` | Optional runtime condition; default `true` |

::: info Difference from IAdminSection
`IAccountSection` has `RequiredPermission` — a section can be hidden for certain users without protecting the entire account area. `IAdminSection` only uses `IsEnabled` and protects the entire body globally via `perm:admin:shell:access`.
:::

## AccountNavItem

```csharp
public sealed record AccountNavItem(string Title, string Href, string Icon);
```

| Parameter | Description |
|---|---|
| `Title` | Link label in the drawer |
| `Href` | Route URL (e.g. `"/account/files"`) |
| `Icon` | MudBlazor icon constant |

## Complete example

### 1. Implement the section

```csharp
// MyModule/Account/MyAccountSection.cs
using BieberWorks.SDK.Account.Contracts;
using MudBlazor;

public sealed class MyAccountSection : IAccountSection
{
    public string Key   => "my-module";   // stable, never change after first deployment
    public string Title => "My Files";
    public string Icon  => Icons.Material.Filled.Folder;
    public int    Order => 100;

    public IReadOnlyList<AccountNavItem> NavItems =>
    [
        new AccountNavItem("Overview",  "/account/files",        Icons.Material.Filled.FolderOpen),
        new AccountNavItem("Uploads",   "/account/files/upload", Icons.Material.Filled.Upload),
    ];

    // Only visible if permission is present
    public string? RequiredPermission => "storage:files:read";
}
```

### 2. Register the section in DI

```csharp
// In IModule.RegisterServices or Program.cs
services.AddSingleton<IAccountSection, MyAccountSection>();
```

::: warning Registration timing
`IAccountSection` implementations must be in the DI container before the first render of `AccountLayout`. This is ensured if they are registered in `IModule.RegisterServices`.
:::

### 3. Create an account page

```razor
@* Pages/Account/MyFilesPage.razor *@
@page "/account/files"
@layout AccountLayout
@implements IAccountPage

<h1>My Files</h1>
```

::: tip @layout
The `@layout AccountLayout` directive is necessary for the page to render within the account shell. Alternatively, `AccountShell` can be set as `DefaultLayout` in a router scope.
:::

### 4. Register the assembly

The assembly containing the page must be registered in the host's `AddAdditionalAssemblies`:

```csharp
// Program.cs
builder.Services
    .AddRazorComponents()
    .AddInteractiveServerComponents()
    .AddAdditionalAssemblies(
        typeof(BieberWorks.SDK.Account.UI.MudBlazor.AccountModule).Assembly,
        typeof(MyModule.Account.MyFilesPage).Assembly
    );
```

And in `Routes.razor`:

```razor
@code {
    private static readonly Assembly[] _moduleAssemblies =
    [
        typeof(BieberWorks.SDK.Account.UI.MudBlazor.AccountModule).Assembly,
        typeof(MyModule.Account.MyFilesPage).Assembly,
    ];
}
```

## RequiredPermission — permission-based visibility

`AccountLayout` checks `RequiredPermission` for each section and renders it in `<AuthorizeView Policy="perm:{key}">` if a value is set:

```razor
@* Internally in AccountLayout *@
@if (section.RequiredPermission is null)
{
    <MudNavGroup ...>...</MudNavGroup>
}
else
{
    <AuthorizeView Policy="@($"perm:{section.RequiredPermission}")">
        <Authorized>
            <MudNavGroup ...>...</MudNavGroup>
        </Authorized>
    </AuthorizeView>
}
```

The user only sees the section if they have the required permission. The pages themselves are protected by `@layout AccountLayout` and rendering behavior, but should additionally carry their own `[Authorize]` attributes.

## IsEnabled — feature-flag-based visibility

```csharp
public bool IsEnabled(IServiceProvider services)
{
    var flags = services.GetService<IFeatureFlagService>();
    return flags?.IsEnabled("MyModule.Files") ?? true;
}
```

`AccountLayout` evaluates `IsEnabled` via `IAccountNavigationService.GetResolvedNav()` and skips disabled sections.
