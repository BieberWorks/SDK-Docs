# IModule & Module System

The module system enables domain logic to be encapsulated in self-contained, self-registering units. A module is a class that implements `IModule` and registers its own services in the DI container.

## IModule

```csharp
namespace BieberWorks.SDK.Core.Modularity;

public interface IModule
{
    string Name { get; }

    IServiceCollection RegisterServices(
        IServiceCollection services,
        IConfiguration configuration);
}
```

`RegisterServices` is called by the discovery mechanism **exactly once**. Multiple calls are protected by an internal `ModuleRegistry` to ensure idempotency.

## IModuleInitializer

```csharp
public interface IModuleInitializer
{
    Task InitializeAsync(
        IServiceProvider serviceProvider,
        CancellationToken cancellationToken = default);
}
```

Optional supplementary interface to `IModule`. Implementations can run EF Core migrations or seed data here. `InitializeAsync` is called by `InitializeBieberWorksModulesAsync` in its own DI scope, ensuring scoped services (e.g., `DbContext`) are available.

## IEndpointModule

```csharp
namespace BieberWorks.SDK.Core.Web.Modularity;

public interface IEndpointModule
{
    void MapEndpoints(IEndpointRouteBuilder endpoints);
}
```

Optional interface for modules that register Minimal API routes. Controller-based modules do not need it — their controllers are discovered automatically via the MVC `ApplicationPart` mechanism.

## Complete Module Example

```csharp
using BieberWorks.SDK.Core.Modularity;
using BieberWorks.SDK.Core.Web.Modularity;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

public sealed class OrderModule : IModule, IModuleInitializer, IEndpointModule
{
    public string Name => "Orders";

    public IServiceCollection RegisterServices(
        IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<OrderDbContext>(opts =>
            opts.UseNpgsql(configuration.GetConnectionString("Default")));

        services.AddScoped<IOrderRepository, OrderRepository>();
        services.AddScoped<
            IAppMessageRequestHandler<PlaceOrderCommand, Result<Guid>>,
            PlaceOrderCommandHandler>();

        return services;
    }

    public async Task InitializeAsync(
        IServiceProvider serviceProvider,
        CancellationToken cancellationToken = default)
    {
        var db = serviceProvider.GetRequiredService<OrderDbContext>();
        await db.Database.MigrateAsync(cancellationToken);
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/orders", async (PlaceOrderRequest req, IAppMessageDispatcher dispatcher) =>
        {
            var result = await dispatcher.SendAsync(new PlaceOrderCommand(req.CustomerId, req.Items));
            return result.Success ? Results.Ok(result.Value) : Results.BadRequest(result.Errors);
        });
    }
}
```

## Program.cs — Host Setup

### Minimal API / Controllers Only

```csharp
var builder = WebApplication.CreateBuilder(args);

// Discovers and registers all IModule implementations in the dependency graph
builder.Services.AddBieberWorksModules(builder.Configuration);

// Messaging infrastructure (Dispatcher + DomainEventPublisher)
builder.Services.AddBieberWorksMessaging();

var app = builder.Build();

// Run EF migrations for all IModuleInitializer modules
await app.InitializeBieberWorksModulesAsync();

// Register Minimal API routes for all IEndpointModule implementations
app.MapBieberWorksModules();

await app.RunAsync();
```

### With Controller Support

```csharp
// AddBieberWorksWeb combines AddBieberWorksModules + AddControllers + ApplicationParts
builder.Services.AddBieberWorksWeb(builder.Configuration);
builder.Services.AddBieberWorksMessaging();

var app = builder.Build();
await app.InitializeBieberWorksModulesAsync();
app.MapControllers();
app.MapBieberWorksModules();
await app.RunAsync();
```

## Extension Methods Overview

### Service Registration

| Method | Package | Description |
|---|---|---|
| `services.AddBieberWorksModules(config)` | `Core` | Discovers all `IModule` via `DependencyContext` and calls `RegisterServices` |
| `services.AddBieberWorksModules(config, assemblies[])` | `Core` | Like above, but with explicitly specified assemblies (test-friendly) |
| `services.AddModule<TModule>(config)` | `Core` | Registers a single module explicitly |
| `services.AddBieberWorksMessaging()` | `Core` | Registers `IAppMessageDispatcher` + `IDomainEventPublisher` as Scoped |
| `services.AddBieberWorksWeb(config)` | `Core.Web` | Combination of `AddBieberWorksModules` + `AddControllers` + `ApplicationParts` |
| `mvcBuilder.AddBieberWorksModuleControllers(services)` | `Core.Web` | Adds module assemblies as MVC `ApplicationPart` |

### Pipeline

| Method | Package | Description |
|---|---|---|
| `host.InitializeBieberWorksModulesAsync(ct?)` | `Core` | Calls `InitializeAsync` for all `IModuleInitializer` modules in a scope |
| `endpoints.MapBieberWorksModules()` | `Core.Web` | Calls `MapEndpoints` for all `IEndpointModule` modules |

::: info Discovery Mechanism
`AddBieberWorksModules` uses `DependencyContext.Default` to scan only actually referenced assemblies. System.*, Microsoft.*, and Serilog.* are skipped. If `DependencyContext` is unavailable (single-file publish), the method falls back to `AppDomain.CurrentDomain.GetAssemblies()`.
:::

::: warning Parameterless Constructor Required
Every `IModule` implementation must have a public parameterless constructor. Dependencies are registered in the DI container via `RegisterServices`, not through constructor injection into the module itself.
:::

## DI Registration of Handlers and Processors

Every Command/Query handler and Domain Event processor must be explicitly registered in `RegisterServices`. The discovery mechanism does not scan handlers automatically — only the module class itself is found via assembly scan.

### Command and Query Handlers

```csharp
// IAppMessageRequestHandler<TCommand, TResult>
services.AddScoped<
    IAppMessageRequestHandler<PlaceOrderCommand, Result<Guid>>,
    PlaceOrderCommandHandler>();

services.AddScoped<
    IAppMessageRequestHandler<GetOrderQuery, Result<OrderDto>>,
    GetOrderQueryHandler>();
```

### Domain Event Processors

```csharp
// IDomainEventProcessor<TEvent>
services.AddScoped<
    IDomainEventProcessor<OrderPlacedEvent>,
    SendOrderConfirmationProcessor>();
```

### Open-Generic Processor (for all events of a base type)

When a processor should apply to all events of an interface type (e.g., auto-auditing):

```csharp
// Registers the handler for EVERY TEvent that implements IDomainEvent
services.AddScoped(
    typeof(IDomainEventProcessor<>),
    typeof(MyGenericProcessor<>));
```

::: tip Convention
Group handler registrations in private helper methods within the module class:

```csharp
public IServiceCollection RegisterServices(IServiceCollection services, IConfiguration config)
{
    RegisterRepositories(services, config);
    RegisterCommandHandlers(services);
    RegisterEventProcessors(services);
    return services;
}

private static void RegisterCommandHandlers(IServiceCollection services)
{
    services.AddScoped<IAppMessageRequestHandler<PlaceOrderCommand, Result<Guid>>, PlaceOrderCommandHandler>();
}

private static void RegisterEventProcessors(IServiceCollection services)
{
    services.AddScoped<IDomainEventProcessor<OrderPlacedEvent>, SendOrderConfirmationProcessor>();
}
```
:::
