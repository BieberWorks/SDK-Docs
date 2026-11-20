# Blazor Route-Override System

`BieberWorks.SDK.Core.Web` provides a priority-based Blazor routing system that allows the host application to override any route that a module declares. This eliminates `AmbiguousMatchException` at startup and makes it possible to replace SDK pages (e.g. login, profile) with a host-specific implementation without forking the module.

## The Problem

ASP.NET Core registers one endpoint per `@page` directive per assembly. When both the host and a module declare the same route template (e.g. `/login`), the runtime throws `AmbiguousMatchException` before any request is processed.

In the Blazor component pipeline a second conflict arises: `Router` resolves components independently of the endpoint layer, so even after suppressing the conflicting endpoint at the ASP.NET Core level, the Blazor `Router` may still navigate to the wrong component.

The BieberWorks routing system solves both layers:

1. **Endpoint layer** — `AddBwModuleAssemblies` suppresses conflicting module component endpoints via `SuppressMatchingMetadata` so only the host component wins at the ASP.NET Core routing layer.
2. **Component layer** — `BwRouter` (in `SDK-UI`) resolves `IRouteOverrideSource` registrations to build a priority-filtered route table, ensuring the highest-priority assembly wins inside the Blazor pipeline.

## Setup

### 1. Register the host as the top-priority route source

```csharp
// Program.cs — service registration
builder.Services.AddBieberWorksRouting(typeof(Program).Assembly);
```

This registers a `DefaultHostRouteOverrideSource` (priority 1000) for the host assembly. Module assemblies are registered automatically at priority 0 by `BwRouter` via `ModuleRouteOverrideSource`.

### 2. Register module assemblies on the Razor Components endpoint

```csharp
// Program.cs — endpoint mapping
app.MapRazorComponents<App>()
   .AddInteractiveServerRenderMode()
   .AddBwModuleAssemblies(typeof(Program).Assembly);
```

`AddBwModuleAssemblies` does the following:

1. Calls `BwUiAssemblyLoader.LoadAll()` to eagerly load all `BieberWorks.SDK.*.UI.*` assemblies from `DependencyContext` — regardless of whether the runtime has already touched a type from them.
2. Discovers all loaded SDK UI module assemblies via `AppDomain.CurrentDomain`.
3. Calls `AddAdditionalAssemblies` with the full set.
4. Attaches a convention that adds `SuppressMatchingMetadata` to any module component endpoint whose route template conflicts with a host route.

Only the specific conflicting endpoint is suppressed — all other routes in the same module assembly remain fully registered.

### Optional: include host-owned feature modules

Pass an `additionalUiPrefixes` array to include assemblies beyond the `BieberWorks.SDK.*` convention:

```csharp
app.MapRazorComponents<App>()
   .AddInteractiveServerRenderMode()
   .AddBwModuleAssemblies(
       typeof(Program).Assembly,
       additionalUiPrefixes: ["MyApp.Modules"]);
```

## IRouteOverrideSource

`IRouteOverrideSource` (in `BieberWorks.SDK.Core.Web.Routing`) is the extensibility point for adding custom priority levels:

```csharp
public interface IRouteOverrideSource
{
    int Priority { get; }
    IReadOnlyCollection<Assembly> RouteAssemblies { get; }
}
```

Built-in priorities:

| Source | Priority |
|---|---|
| `DefaultHostRouteOverrideSource` (host entry-point assembly) | 1000 |
| `ModuleRouteOverrideSource` (module assemblies) | 0 |

Register additional sources for intermediate plug-in scenarios:

```csharp
services.TryAddEnumerable(
    ServiceDescriptor.Singleton<IRouteOverrideSource>(
        new MyPluginRouteOverrideSource(pluginAssembly, priority: 500)));
```

`BwRouter` collects all registered `IRouteOverrideSource` instances, sorts by `Priority` descending, and resolves conflicts at the component level. A route declared by a higher-priority source wins over the same route in a lower-priority source.

## BwUiAssemblyLoader

`BwUiAssemblyLoader` eagerly loads SDK UI module assemblies at startup. ASP.NET Core builds its endpoint route table before most module assemblies have been touched, causing intermittent 404s on deep-links. `LoadAll()` resolves this by walking `DependencyContext.Default` (the full compile-time dependency graph) rather than relying on `AppDomain.CurrentDomain` (which only contains already-loaded assemblies).

```csharp
// Called automatically by AddBwModuleAssemblies — no manual call needed in most cases.
BwUiAssemblyLoader.LoadAll();

// Include host-owned module assemblies alongside the SDK convention:
BwUiAssemblyLoader.LoadAll(["MyApp.Modules"]);
```

An assembly is considered a UI module assembly when its name starts with `BieberWorks.SDK.` and does not end with `.Contracts`, `.Core`, `.Core.Web`, or `.SharedKernel`.

Diagnostic information about discovered assemblies is available via:

```csharp
IReadOnlyList<string> loaded = BwUiAssemblyLoader.DiscoveredAssemblyNames;
```
