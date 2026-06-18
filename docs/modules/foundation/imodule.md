# IModule & Modul-System

Das Modul-System ermöglicht es, Fach-Logik in eigenständige, selbst-registrierende Einheiten zu kapseln. Ein Modul ist eine Klasse, die `IModule` implementiert und ihre eigenen Services in den DI-Container einträgt.

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

`RegisterServices` wird vom Discovery-Mechanismus **genau einmal** aufgerufen. Mehrfache Aufrufe sind durch eine interne `ModuleRegistry` idempotent abgesichert.

## IModuleInitializer

```csharp
public interface IModuleInitializer
{
    Task InitializeAsync(
        IServiceProvider serviceProvider,
        CancellationToken cancellationToken = default);
}
```

Optionales Ergänzungs-Interface zu `IModule`. Implementierungen können hier EF Core-Migrationen ausführen oder Seed-Daten eintragen. `InitializeAsync` wird von `InitializeBieberWorksModulesAsync` in einem eigenen DI-Scope aufgerufen, sodass scoped Services (z.B. `DbContext`) verfügbar sind.

## IEndpointModule

```csharp
namespace BieberWorks.SDK.Core.Web.Modularity;

public interface IEndpointModule
{
    void MapEndpoints(IEndpointRouteBuilder endpoints);
}
```

Optionales Interface für Module, die Minimal-API-Routen registrieren. Controller-basierte Module brauchen es nicht — deren Controller werden über den MVC `ApplicationPart`-Mechanismus automatisch gefunden.

## Vollständiges Modul-Beispiel

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

## Program.cs — Host-Setup

### Nur Minimal-API / Controller

```csharp
var builder = WebApplication.CreateBuilder(args);

// Entdeckt und registriert alle IModule-Implementierungen im Dependency-Graph
builder.Services.AddBieberWorksModules(builder.Configuration);

// Messaging-Infrastruktur (Dispatcher + DomainEventPublisher)
builder.Services.AddBieberWorksMessaging();

var app = builder.Build();

// EF-Migrationen aller IModuleInitializer-Module ausführen
await app.InitializeBieberWorksModulesAsync();

// Minimal-API-Routen aller IEndpointModule registrieren
app.MapBieberWorksModules();

await app.RunAsync();
```

### Mit Controller-Support

```csharp
// AddBieberWorksWeb kombiniert AddBieberWorksModules + AddControllers + ApplicationParts
builder.Services.AddBieberWorksWeb(builder.Configuration);
builder.Services.AddBieberWorksMessaging();

var app = builder.Build();
await app.InitializeBieberWorksModulesAsync();
app.MapControllers();
app.MapBieberWorksModules();
await app.RunAsync();
```

## Extension-Methoden im Überblick

### Service-Registration

| Methode | Paket | Beschreibung |
|---|---|---|
| `services.AddBieberWorksModules(config)` | `Core` | Entdeckt alle `IModule` via `DependencyContext` und ruft `RegisterServices` auf |
| `services.AddBieberWorksModules(config, assemblies[])` | `Core` | Wie oben, aber mit explizit angegebenen Assemblies (testfreundlich) |
| `services.AddModule<TModule>(config)` | `Core` | Registriert ein einzelnes Modul explizit |
| `services.AddBieberWorksMessaging()` | `Core` | Registriert `IAppMessageDispatcher` + `IDomainEventPublisher` als Scoped |
| `services.AddBieberWorksWeb(config)` | `Core.Web` | Kombination aus `AddBieberWorksModules` + `AddControllers` + `ApplicationParts` |
| `mvcBuilder.AddBieberWorksModuleControllers(services)` | `Core.Web` | Fügt Modul-Assemblies als MVC `ApplicationPart` hinzu |

### Pipeline

| Methode | Paket | Beschreibung |
|---|---|---|
| `host.InitializeBieberWorksModulesAsync(ct?)` | `Core` | Ruft `InitializeAsync` aller `IModuleInitializer`-Module in einem Scope auf |
| `endpoints.MapBieberWorksModules()` | `Core.Web` | Ruft `MapEndpoints` aller `IEndpointModule`-Module auf |

::: info Discovery-Mechanismus
`AddBieberWorksModules` nutzt `DependencyContext.Default`, um nur die tatsächlich referenzierten Assemblies zu scannen. System.*, Microsoft.* und Serilog.* werden übersprungen. Falls `DependencyContext` nicht verfügbar ist (single-file publish), fällt die Methode auf `AppDomain.CurrentDomain.GetAssemblies()` zurück.
:::

::: warning Parameterloser Konstruktor erforderlich
Jede `IModule`-Implementierung muss einen öffentlichen parameterlosen Konstruktor haben. Abhängigkeiten werden über `RegisterServices` in den DI-Container eingetragen, nicht per Konstruktor-Injektion ins Modul selbst.
:::

## DI-Registrierung von Handlers und Processors

Jeder Command-/Query-Handler und jeder Domain-Event-Processor muss explizit in `RegisterServices` registriert werden. Der Discovery-Mechanismus scannt keine Handler automatisch — nur die Modul-Klasse selbst wird per Assembly-Scan gefunden.

### Command- und Query-Handler

```csharp
// IAppMessageRequestHandler<TCommand, TResult>
services.AddScoped<
    IAppMessageRequestHandler<PlaceOrderCommand, Result<Guid>>,
    PlaceOrderCommandHandler>();

services.AddScoped<
    IAppMessageRequestHandler<GetOrderQuery, Result<OrderDto>>,
    GetOrderQueryHandler>();
```

### Domain-Event-Processors

```csharp
// IDomainEventProcessor<TEvent>
services.AddScoped<
    IDomainEventProcessor<OrderPlacedEvent>,
    SendOrderConfirmationProcessor>();
```

### Open-Generic-Processor (für alle Event-Typen einer Basis)

Wenn ein Processor für alle Events eines Interface-Typs gelten soll (z. B. Auto-Auditing):

```csharp
// Registriert den Handler für JEDEN TEvent, der IDomainEvent implementiert
services.AddScoped(
    typeof(IDomainEventProcessor<>),
    typeof(MyGenericProcessor<>));
```

::: tip Konvention
Gruppiere Handler-Registrierungen in privaten Hilfsmethoden innerhalb der Modul-Klasse:

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
