# Foundation

Foundation is the cornerstone of all BieberWorks SDK modules. It provides dependency-free base types (SharedKernel), the module system with DI integration (Core), and ASP.NET Core binding (Core.Web). No domain module contains framework dependencies that do not belong in these three packages. All other modules depend on Foundation — never the reverse.

## Packages

| Package | Description | Version |
|---|---|---|
| `BieberWorks.SDK.SharedKernel` | Dependency-free base types: `IDomainEvent`, `IAuditableEvent`, `Result`/`Result<T>`, `DomainError` | ![v0.3.0](https://img.shields.io/badge/version-0.3.0-blue) |
| `BieberWorks.SDK.Core` | Module system (`IModule`, Discovery, DI registration) + Messaging (`IAppMessageDispatcher`, `IDomainEventPublisher`, `IDomainEventProcessor<T>`) | ![v0.3.0](https://img.shields.io/badge/version-0.3.0-blue) |
| `BieberWorks.SDK.Core.Web` | ASP.NET Core integration: `IEndpointModule`, `AddBieberWorksModules`, `MapBieberWorksModules`, `InitializeBieberWorksModulesAsync`, layered localization | ![v0.3.0](https://img.shields.io/badge/version-0.3.0-blue) |

## Dependency Graph

```
BieberWorks.SDK.Core.Web
  └── BieberWorks.SDK.Core
        └── BieberWorks.SDK.SharedKernel   (no external dependencies)
```

Domain modules (Auth, Audit, Storage, …) reference as needed:

- `BieberWorks.SDK.SharedKernel` — for `IDomainEvent`, `IAuditableEvent`, `Result`, `DomainError`
- `BieberWorks.SDK.Core` — for `IModule`, Messaging interfaces
- `BieberWorks.SDK.Core.Web` — if the module needs HTTP endpoints or the localization layer

## Which Package to Install

```
Do I only need Result / DomainError / IDomainEvent?
  └─ Yes  →  BieberWorks.SDK.SharedKernel

Am I implementing a module (IModule) or using the dispatcher?
  └─ Yes  →  BieberWorks.SDK.Core         (pulls SharedKernel automatically)

Am I registering Minimal API endpoints or controllers?
  └─ Yes  →  BieberWorks.SDK.Core.Web     (pulls Core + SharedKernel)

Am I building the host (Program.cs / WebApplication)?
  └─ Yes  →  BieberWorks.SDK.Core.Web     (contains AddBieberWorksModules,
                                           MapBieberWorksModules,
                                           InitializeBieberWorksModulesAsync)
```

::: tip NuGet Reference Range
Internal module references to Foundation float with `0.*-*`, so RC packages are resolved automatically.
:::
