# Create a Module

This guide walks through creating a new BieberWorks SDK module — from GitHub repo creation to IModule implementation, DbContext, Contracts split, and extension point registration.

## When to Create a New Module

Create a new module when you have a bounded context that:

- owns its own data (its own PostgreSQL schema and DbContext),
- should be optional in the host (installable via NuGet), and
- must not be coupled to other modules at the database level.

## Scaffold the Repo

Use `New-BwModuleRepo` from the PowerShell module `BieberWorks.RepoSetup` (see [Templates](/guide/templates)). Never create the repo by hand.

```powershell
New-BwModuleRepo -RepoName SDK-MyModule -Owner BieberWorks
```

`-Owner` is mandatory. The function creates the GitHub repo with branches `main`, `staging` and `dev` (default branch `dev`), CI/release workflows, `Directory.Build.props`, the solution file and a local clone, and scaffolds the internal template `bieberworks-module` (Contracts + Impl + Tests). `tooling\powershell\github\create-repo-module.ps1` is only a thin wrapper around it.

Optional switches (template 0.8.0): `-WithClient` adds the `.Client` project (HTTP client plus contract tests over both transports), `-WithUi` adds `.Presentation`, `.UI.Blazor` and `.UI.Blazor.MudBlazor`, `-NoPersistence` creates a module without a DbContext, `-NoArchTests` omits the architecture test project (included by default) and `-NoDocs` omits the `docs/` scaffold (included by default). See [Templates](/guide/templates#module-template-switches-bieberworks-module-template-0-8-0), [Client Pattern](/guide/client-pattern) and [Testing Conventions](/guide/testing-conventions).

## Project Structure

```
SDK-MyModule/
├── src/
│   ├── MyModule.Contracts/    ← interfaces, DTOs, events, permissions
│   ├── MyModule/              ← implementation, DbContext, migrations, handlers
│   └── MyModule.Client/       ← optional (-WithClient): HTTP client
├── tests/
│   ├── MyModule.Tests/
│   └── MyModule.ArchitectureTests/   ← default, strict mode
└── docs/
    ├── index.md
    └── setup.md
```

::: tip Naming convention
`.csproj` names are short (`MyModule`, `MyModule.Contracts`). NuGet package IDs are built automatically as `BieberWorks.SDK.MyModule` and `BieberWorks.SDK.MyModule.Contracts` via `Directory.Build.props`.
:::

## Contracts Split — What Goes Where

| Belongs in `*.Contracts` | Belongs in implementation (`MyModule`) |
|---|---|
| Interfaces (`IMyService`) | DbContext, EF entity models |
| DTOs / request records | Service implementations |
| Domain events | CQRS handlers |
| Permission constants | Migrations |
| | EF configurations |
| | REST endpoints |
| | `IPermissionContributor` implementation |

`IPermissionContributor` itself comes from `BieberWorks.SDK.Core.Authorization` (Foundation). `IAdminSection` / `IAccountSection` implementations belong in the module's `*.Presentation` project (all SDK modules do this, e.g. `Auth.Presentation/AdminSection`), not in `*.Contracts`.

## IModule Implementation

```csharp
using BieberWorks.SDK.Core.Modularity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

public sealed class MyModule : IModule, IModuleInitializer, IEndpointModule
{
    public string Name => "BieberWorks.SDK.MyModule";

    public IServiceCollection RegisterServices(
        IServiceCollection services,
        IConfiguration configuration)
    {
        RegisterPersistence(services, configuration);
        RegisterCommandHandlers(services);
        RegisterEventProcessors(services);
        return services;
    }

    private static void RegisterPersistence(IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("MyModuleDb")
            ?? configuration.GetConnectionString("DefaultConnection");

        services.AddDbContext<MyModuleDbContext>(opts =>
            opts.UseNpgsql(connectionString, npgsql =>
                npgsql.MigrationsHistoryTable("__EFMigrationsHistory", MyModuleDbContext.Schema)));
    }

    private static void RegisterCommandHandlers(IServiceCollection services)
    {
        services.AddScoped<
            IAppMessageRequestHandler<DoSomethingCommand, Result>,
            DoSomethingCommandHandler>();
    }

    private static void RegisterEventProcessors(IServiceCollection services)
    {
        services.AddScoped<
            IDomainEventProcessor<SomethingHappenedEvent>,
            SomethingHappenedEventHandler>();
    }
}
```

::: warning Parameterless constructor required
`IModule` implementations must have a public parameterless constructor. They are instantiated by the discovery mechanism before the DI container is built.
:::

## IModuleInitializer — EF Core Migrations

```csharp
public async Task InitializeAsync(
    IServiceProvider serviceProvider,
    CancellationToken cancellationToken = default)
{
    var db = serviceProvider.GetRequiredService<MyModuleDbContext>();
    await db.Database.MigrateAsync(cancellationToken);
}
```

## IEndpointModule — Minimal API Routes

```csharp
public void MapEndpoints(IEndpointRouteBuilder endpoints)
{
    endpoints.MapGet("/api/mymodule/items", async (IMyModuleService svc) =>
    {
        var items = await svc.GetItemsAsync();
        return Results.Ok(items);
    }).RequireAuthorization();
}
```

## DbContext — Own PostgreSQL Schema

```csharp
public class MyModuleDbContext(DbContextOptions<MyModuleDbContext> options)
    : DbContext(options)
{
    public const string Schema = "mymodule";

    public DbSet<MyEntity> MyEntities => Set<MyEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);
    }
}
```

## Adding a Migration

```powershell
dotnet ef migrations add InitialCreate `
  --project src\MyModule `
  --startup-project ..\Sandbox
```

::: warning Always build first
Never use `--no-build`. Without it, EF uses the freshly compiled DLL. With it, stale DLLs can produce wrong or duplicate migrations. See [Migrations](/guide/migrations).
:::

## IPermissionContributor — Custom Permissions

```csharp
// In the module implementation (IPermissionContributor is in BieberWorks.SDK.Core.Authorization):
public sealed class MyModulePermissions : IPermissionContributor
{
    public const string ItemsRead   = "mymodule:items:read";
    public const string ItemsManage = "mymodule:items:manage";

    public IReadOnlyList<PermissionDefinition> GetPermissions() =>
    [
        new(ItemsRead,   "Items", "Read item list"),
        new(ItemsManage, "Items", "Create, update, delete items"),
    ];
}

// In RegisterServices:
services.AddPermissionContributor<MyModulePermissions>();
```

## Domain Events and Auto-Auditing

```csharp
// In MyModule.Contracts — no reference to SDK-Audit needed
public record ItemCreatedEvent(string ItemId, string CreatedByUserId)
    : IDomainEvent, IAuditableEvent
{
    public string AuditAction     => "ItemCreated";
    public string AuditResource   => "Item";
    public string AuditResourceId => ItemId;
    public string AuditUserId     => CreatedByUserId;
    public string? AuditDetails   => null;
}
```

When SDK-Audit is installed in the host, it captures this event automatically via its open-generic handler.

## IAdminSection — Plug into the Admin Shell

Place the implementation in the module's `*.Presentation` project.

```csharp
public sealed class MyModuleAdminSection : IAdminSection
{
    public string Title => "My Module";
    public string Icon  => Icons.Material.Filled.Extension;
    public int    Order => 500;

    public IReadOnlyList<AdminNavItem> NavItems =>
    [
        new("Items", "/admin/mymodule/items", Icons.Material.Filled.List),
    ];

    public bool IsEnabled(IServiceProvider sp) => true;
}

// In RegisterServices:
services.AddSingleton<IAdminSection, MyModuleAdminSection>();
```

## IAccountSection — Plug into the Account Shell

```csharp
public sealed class MyModuleAccountSection : IAccountSection
{
    public string Title               => "My Items";
    public string Icon                => Icons.Material.Filled.FolderOpen;
    public int    Order               => 300;
    public string? RequiredPermission => null;

    public IReadOnlyList<AccountNavItem> NavItems =>
    [
        new("My Items", "/account/mymodule"),
    ];
}

// In RegisterServices:
services.AddSingleton<IAccountSection, MyModuleAccountSection>();
```

## DI Registration Conventions

| Type | Registration | Lifetime |
|---|---|---|
| Command / Query handler | `services.AddScoped<IAppMessageRequestHandler<TCmd, TResult>, THandler>()` | Scoped |
| Domain event processor | `services.AddScoped<IDomainEventProcessor<TEvent>, THandler>()` | Scoped |
| Permission contributor | `services.AddPermissionContributor<TContributor>()` | Singleton |
| Admin section | `services.AddSingleton<IAdminSection, TSection>()` | Singleton |
| Account section | `services.AddSingleton<IAccountSection, TSection>()` | Singleton |
| AppBar widget | `services.AddSingleton<IAppBarWidget>(new TWidget())` | Singleton |
| Repository / Service | `services.AddScoped<IMyService, MyService>()` | Scoped |
