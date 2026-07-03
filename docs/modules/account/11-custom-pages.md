# Custom Account Pages

Other modules plug custom self-service pages into the account area by implementing `IAccountSection` and marking pages with `IAccountPage`.

## IAccountPage

Marker interface for routable Blazor pages in the account area.

```csharp
public interface IAccountPage;
```

This interface allows tools or filters to identify all account pages in an assembly. It has no required members.

## IAccountSection

`IAccountSection` (in `Account.Contracts`) is an empty marker interface deriving from
`BieberWorks.SDK.Shell.Contracts.IShellSection` (the generic navigation kernel provided by
the standalone **SDK-Shell** module). It scopes section registrations to the Account shell —
implement `IAccountSection` (not the base `IShellSection` directly) so the Account shell's
`IShellNavigationService<IAccountSection>` picks it up, keeping it separate from Admin
sections.

```csharp
public interface IAccountSection : BieberWorks.SDK.Shell.Contracts.IShellSection
{
}
```

All members are inherited from `IShellSection`:

```csharp
public interface IShellSection
{
    string Key   { get; }  // stable, lower-kebab-case, globally unique
    string Title { get; }
    string Icon  { get; }
    int    Order { get; }
    IReadOnlyList<ShellNavItem> NavItems { get; }

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
| `NavItems` | List of `ShellNavItem` navigation links in this section |
| `RequiredPermission` | Optional permission key in format `{module}:{resource}:{action}`; `null` = always visible |
| `IsEnabled` | Optional runtime condition; default `true` |

::: info Difference from IAdminSection
`IAdminSection` (SDK-Admin) is the equivalent marker over `IShellSection` for the Admin shell —
both are thin markers with identical inherited members. The behavioral difference is at the
layout level: `AccountLayout` gates individual sections via `RequiredPermission` while leaving
the rest of the area visible, whereas `AdminLayout` additionally protects the entire body via
one shell-level policy (`perm:admin:shell:access`, set on the Admin `ShellDefinition`).
:::

## ShellNavItem

```csharp
public sealed record ShellNavItem
{
    public required string Title { get; init; }
    public required string Href { get; init; }
    public required string Icon { get; init; }
}
```

| Property | Description |
|---|---|
| `Title` | Link label in the drawer |
| `Href` | Route URL (e.g. `"/account/files"`) |
| `Icon` | MudBlazor icon constant |

`ShellNavItem` lives in `BieberWorks.SDK.Shell.Contracts`, not in `Account.Contracts`.

## Complete example

### 1. Implement the section

```csharp
// MyModule/Account/MyAccountSection.cs
using BieberWorks.SDK.Account.Contracts;
using BieberWorks.SDK.Shell.Contracts;
using MudBlazor;

public sealed class MyAccountSection : IAccountSection
{
    public string Key   => "my-module";   // stable, never change after first deployment
    public string Title => "My Files";
    public string Icon  => Icons.Material.Filled.Folder;
    public int    Order => 100;

    public IReadOnlyList<ShellNavItem> NavItems =>
    [
        new ShellNavItem { Title = "Overview", Href = "/account/files",        Icon = Icons.Material.Filled.FolderOpen },
        new ShellNavItem { Title = "Uploads",  Href = "/account/files/upload", Icon = Icons.Material.Filled.Upload },
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

`AccountLayout` evaluates `IsEnabled` via `IShellNavigationService<IAccountSection>.GetResolvedNav()` and skips disabled sections.
