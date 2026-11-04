# Module Integration — Checklist

This page describes step-by-step how to integrate a new SDK module into an existing host. All cross-cutting concerns (DI, Permissions, Localization, Auditing, UI, Messaging) are covered.

::: info Prerequisite
The host uses `AddBieberWorksModules` from `SDK-Foundation`. All modules register themselves via `IModule.RegisterServices` — manual `services.Add…` calls are only needed for optional extensions.
:::

## Step 1 — Add NuGet Packages

Add the module package and (if present) the contracts package to the host `.csproj`:

```xml
<!-- Contracts — referenced by other modules too -->
<PackageReference Include="BieberWorks.SDK.<ModuleName>.Contracts" Version="0.*-*" />

<!-- Implementation — host only -->
<PackageReference Include="BieberWorks.SDK.<ModuleName>" Version="0.*-*" />

<!-- UI (optional) — only if MudBlazor pages are used -->
<PackageReference Include="BieberWorks.SDK.<ModuleName>.UI.Blazor.MudBlazor" Version="0.*-*" />
```

All packages come from GitHub Packages of the `BieberWorks` org. Ensure that `nuget.config` contains the feed with a PAT (scope `read:packages`).

## Step 2 — `AddBieberWorksModules` is Enough for the Basics

`IModule` implementations are automatically discovered by assembly scan:

```csharp
// Program.cs
builder.Services.AddBieberWorksModules(builder.Configuration);
```

This is the only mandatory call. Everything else is modularly optional.

## Step 3 — Ensure Messaging Infrastructure

If the module sends commands/queries via `IAppMessageDispatcher` or registers `IDomainEventProcessor<T>`, messaging must be active. `AddBieberWorksModules` registers the messaging infrastructure automatically, so no extra call is needed. An explicit call is optional:

```csharp
// Program.cs — optional
builder.Services.AddBieberWorksMessaging();
```

::: tip Idempotent
`AddBieberWorksMessaging()` can be called multiple times — subsequent calls are no-ops.
:::

### Register Handlers in the Module

Each command/query handler must be explicitly registered in the module's `*Module.cs`:

```csharp
// In MyModule.RegisterServices()
services.AddScoped<
    IAppMessageRequestHandler<MyCommand, Result<Guid>>,
    MyCommandHandler>();

// Domain event processor
services.AddScoped<
    IDomainEventProcessor<MyDomainEvent>,
    MyDomainEventProcessor>();
```

## Step 4 — Register Permissions (if the module defines them)

If the module protects permissions, implement `IPermissionContributor` and register it with `AddPermissionContributor<T>()`. The Auth module reads all contributors at startup:

```csharp
// In MyModule.RegisterServices()
services.AddPermissionContributor<MyModulePermissionContributor>();
```

```csharp
// MyModulePermissionContributor.cs
public sealed class MyModulePermissionContributor : IPermissionContributor
{
    public IEnumerable<PermissionDefinition> GetPermissions()
    {
        yield return new PermissionDefinition(
            Key:         "mymodule:resource:read",
            DisplayName: "View Resource",
            Module:      "MyModule",
            Group:       "Resource");

        yield return new PermissionDefinition(
            Key:         "mymodule:resource:manage",
            DisplayName: "Manage Resource",
            Module:      "MyModule",
            Group:       "Resource");
    }
}
```

Then assign the permission to the admin role in the Admin UI (`/admin/roles`).

::: warning Auth Module Required
`IPermissionContributor` lives in `BieberWorks.SDK.Core.Authorization` (SDK-Foundation), so modules need no reference to Auth. The Auth module must be installed in the host for contributors to be processed.
:::

## Step 5 — Activate Auto-Auditing (if domain events should be audited)

Install `SDK-Audit` in the host. No additional code in the domain module is needed — the event only needs to implement `IAuditableEvent`:

```csharp
// MyDomainEvent.cs — in the module's Contracts package
using BieberWorks.SDK.SharedKernel;

public sealed record MyResourceCreatedEvent(
    Guid ResourceId,
    string ActorId) : IAuditableEvent
{
    public string  AuditAction     => "mymodule:resource:created";
    public string  AuditResource   => "Resource";
    public string? AuditResourceId => ResourceId.ToString();
    public string? AuditUserId     => ActorId;
    public string? AuditDetails    => null;
}
```

The open-generic handler `AuditableEventHandler<TEvent>` in SDK-Audit takes care of the rest automatically.

::: info Only SharedKernel Reference Required
`IAuditableEvent` lives in `BieberWorks.SDK.SharedKernel`. The domain module needs no dependency on `BieberWorks.SDK.Audit` or `BieberWorks.SDK.Audit.Contracts`.
:::

## Step 6 — Add Localization (if the module has localizable texts)

### Create resx Files

Create one or more resource files per module:

```
src/MyModule.Contracts/Resources/
    MyModuleResources.resx        ← Neutral/English
    MyModuleResources.de.resx     ← German
```

### Use IStringLocalizer in Components

```csharp
[Inject] IStringLocalizer<MyModuleResources> Loc { get; set; } = default!;

string label = Loc["MyModule_Label_Title"];
```

### Configure Key Discovery (for Admin UI Translation Editor)

For SDK-Localization to display the module's keys in the translation editor, the assembly prefix must be known. This is done once in the host:

```csharp
// Program.cs
builder.Services.Configure<LocalizationScanOptions>(options =>
{
    // Required for assemblies whose name does NOT start with "BieberWorks.SDK.":
    options.AdditionalAssemblyPrefixes.Add("MyApp.");

    // Optional display name in the translation editor:
    options.SetDisplayName("MyModule", "My Module");
});
```

::: tip BieberWorks.SDK.* Assemblies
Assemblies with the prefix `BieberWorks.SDK.` are scanned automatically — no entry in `AdditionalAssemblyPrefixes` needed.
:::

## Step 7 — UI Assembly Wiring (if the module contains Razor pages)

If the module provides a `*.UI.Blazor.MudBlazor` package, its pages must be known to the endpoint routing (server) and to the Blazor router (client). The recommended setup is `BwRouter` plus `AddBwModuleAssemblies`, which discover all `BieberWorks.SDK.*` UI assemblies automatically — no per-module assembly list. **Both** places use them:

### Program.cs

```csharp
app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode()
    .AddBwModuleAssemblies(typeof(Program).Assembly);
```

### Routes.razor

```razor
@using BieberWorks.SDK.UI.Blazor.MudBlazor.Routing

<BwThemeProvider>
    <BwRouter AppAssembly="typeof(App).Assembly">
        <Found Context="routeData">
            <RouteView RouteData="@routeData" DefaultLayout="@typeof(MainLayout)" />
            <FocusOnNavigate RouteData="@routeData" Selector="h1" />
        </Found>
    </BwRouter>
</BwThemeProvider>
```

`BwRouter` lives in the namespace `BieberWorks.SDK.UI.Blazor.MudBlazor.Routing`. `AppAssembly` is required.

### Host-owned modules with a custom prefix

Modules whose assembly name does not start with `BieberWorks.SDK.` (e.g. `MyApp.Modules.Files.UI.Blazor.MudBlazor`) are not auto-discovered by convention. Pass the prefix on both sides (supported since Foundation 2.3.2 / SDK-UI 1.3.2):

```csharp
// Program.cs
app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode()
    .AddBwModuleAssemblies(typeof(Program).Assembly, additionalUiPrefixes: ["MyApp.Modules"]);
```

```razor
<BwRouter AppAssembly="typeof(App).Assembly" AdditionalUiPrefixes="@(["MyApp.Modules"])">
    ...
</BwRouter>
```

`BwRouter.AdditionalModuleAssemblies` merges explicit assembly instances. Setting `ModuleAssemblies` is a full override: the additional parameters are ignored.

::: warning BwThemeProvider
`BwThemeProvider` must exist exactly once in `Routes.razor` — not in individual layouts. Otherwise, theme state is reset on every navigation.
:::

### Admin Shell Integration (IAdminSection)

If the module should display admin pages under the admin shell:

```csharp
// In MyModule.RegisterServices()
services.AddSingleton<IAdminSection, MyModuleAdminSection>();
```

Place the `IAdminSection` implementation in the module's `*.Presentation` project (e.g. `Auth.Presentation/AdminSection`), not in `*.Contracts`.

### Account Shell Integration (IAccountSection)

Analogously for account-related pages:

```csharp
// In MyModule.RegisterServices()
services.AddSingleton<IAccountSection, MyModuleAccountSection>();
```

## Step 8 — Migrations and Startup

If the module has its own `DbContext`, implement `IModuleInitializer`:

```csharp
public sealed class MyModule : IModule, IModuleInitializer
{
    public string Name => "MyModule";

    public IServiceCollection RegisterServices(
        IServiceCollection services,
        IConfiguration configuration)
    {
        // Convention: <Module>Db first, then DefaultConnection
        var connectionString = configuration.GetConnectionString("MyModuleDb")
            ?? configuration.GetConnectionString("DefaultConnection");

        services.AddDbContext<MyDbContext>(opts =>
            opts.UseNpgsql(connectionString));
        // ...
        return services;
    }

    public async Task InitializeAsync(
        IServiceProvider serviceProvider,
        CancellationToken cancellationToken = default)
    {
        var db = serviceProvider.GetRequiredService<MyDbContext>();
        await db.Database.MigrateAsync(cancellationToken);
    }
}
```

`InitializeBieberWorksModulesAsync()` in the host calls all `IModuleInitializer` in a dedicated DI scope:

```csharp
// Program.cs
await app.InitializeBieberWorksModulesAsync();
```

## Complete Program.cs — Reference

```csharp
using BieberWorks.SDK.Admin.UI.Blazor.MudBlazor.Extensions;
using BieberWorks.SDK.Audit.UI.Blazor.MudBlazor.Extensions;
using BieberWorks.SDK.Localization.UI.Blazor.MudBlazor.Extensions;
using BieberWorks.SDK.Settings.UI.Blazor.MudBlazor.Extensions;
using BieberWorks.SDK.UI.Blazor.MudBlazor.Extensions;

var builder = WebApplication.CreateBuilder(args);

// 1. Load all IModule automatically (Foundation, Auth, Email, Audit, Localization, Settings, …)
builder.Services.AddBieberWorksModules(builder.Configuration);

// (Messaging is registered automatically by AddBieberWorksModules.)

// 2. UI packages (order: UI first)
builder.Services.AddBieberWorksUi();
builder.Services.AddBieberWorksAdmin();
builder.Services.AddBieberWorksAccount();  // if used

// 3. Optional module UIs
builder.Services.AddAuditUi();
builder.Services.AddLocalizationUi();
builder.Services.AddSettingsUi();

builder.Services
    .AddRazorComponents()
    .AddInteractiveServerComponents();

var app = builder.Build();

app.UseAuthentication();
app.UseAuthorization();

// 6. Migrations + startup tasks of all IModuleInitializer
await app.InitializeBieberWorksModulesAsync();

// 7. Map endpoints of all IEndpointModule
app.MapBieberWorksModules();

// 8. Blazor + all module assemblies (auto-discovered)
app.MapRazorComponents<App>()
   .AddInteractiveServerRenderMode()
   .AddBwModuleAssemblies(typeof(Program).Assembly);

await app.RunAsync();
```

## Checklist

| # | Task | Applies if |
|---|---|---|
| 1 | Add NuGet packages (`*.Contracts` + Impl + optional `*.UI.Blazor.MudBlazor`) | always |
| 2 | `AddBieberWorksModules` present in host | always |
| 3 | Messaging active (automatic via `AddBieberWorksModules`; explicit `AddBieberWorksMessaging()` is optional) | Module has handlers/processors |
| 4 | Handler in `Module.cs` registered as `IAppMessageRequestHandler<…>` | Module has command/query handlers |
| 5 | EventProcessor in `Module.cs` registered as `IDomainEventProcessor<…>` | Module has event processors |
| 6 | `IPermissionContributor` registered via `AddPermissionContributor<T>()` and permission assigned to admin role | Module protects pages/endpoints |
| 7 | Domain events implement `IAuditableEvent` | Module should be audited |
| 8 | `resx` files created; `AdditionalAssemblyPrefixes` configured | Module has localizable texts |
| 9 | `AddBwModuleAssemblies` in `Program.cs` (plus `additionalUiPrefixes` for host-owned prefixes) | Module has Razor pages |
| 10 | `<BwRouter>` in `Routes.razor` (plus `AdditionalUiPrefixes` for host-owned prefixes) | Module has Razor pages |
| 11 | `IAdminSection` registered (implementation in `*.Presentation`) | Module has admin pages |
| 12 | `IAccountSection` registered | Module has account pages |
| 13 | `IModuleInitializer` implemented; `InitializeBieberWorksModulesAsync` called | Module has DbContext/Migrations |
