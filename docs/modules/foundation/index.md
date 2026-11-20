# Foundation

Foundation is the cornerstone of all BieberWorks SDK modules. It provides dependency-free base types (SharedKernel), the module system with DI integration (Core), and ASP.NET Core binding (Core.Web). No domain module contains framework dependencies that do not belong in these three packages. All other modules depend on Foundation — never the reverse.

## Packages

| Package | Description |
|---|---|
| `BieberWorks.SDK.SharedKernel` | Dependency-free base types: `IDomainEvent`, `IAuditableEvent`, `Result`/`Result<T>`, `DomainError`, `EntityBase`, `LocalizedText`, GDPR data-subject contracts |
| `BieberWorks.SDK.Core` | Module system (`IModule`, Discovery, DI registration) + Messaging (`IAppMessageDispatcher`, `IDomainEventPublisher`, `IDomainEventProcessor<T>`) |
| `BieberWorks.SDK.Core.Postgres` | PostgreSQL data-layer helpers: execution-strategy-safe transactions, optimistic-concurrency retry, `AddBieberWorksNpgsql<TContext>`, transactional outbox |
| `BieberWorks.SDK.Core.Web` | ASP.NET Core integration: `IEndpointModule`, `AddBieberWorksModules`, `MapBieberWorksModules`, `InitializeBieberWorksModulesAsync`, layered localization, Blazor route-override system |

See the [GitHub Releases page](https://github.com/BieberWorks/SDK-Foundation/releases) for the current published version.

## Dependency Graph

```
BieberWorks.SDK.Core.Web
  └── BieberWorks.SDK.Core
        └── BieberWorks.SDK.SharedKernel   (no external dependencies)

BieberWorks.SDK.Core.Postgres
  └── BieberWorks.SDK.SharedKernel         (no ASP.NET Core dependency)
```

Domain modules (Auth, Audit, Storage, …) reference as needed:

- `BieberWorks.SDK.SharedKernel` — for `IDomainEvent`, `IAuditableEvent`, `Result`, `DomainError`
- `BieberWorks.SDK.Core` — for `IModule`, Messaging interfaces
- `BieberWorks.SDK.Core.Postgres` — for PostgreSQL transactions, outbox, Npgsql registration
- `BieberWorks.SDK.Core.Web` — if the module needs HTTP endpoints or the localization layer

## Which Package to Install

```
Do I only need Result / DomainError / IDomainEvent?
  └─ Yes  →  BieberWorks.SDK.SharedKernel

Am I implementing a module (IModule) or using the dispatcher?
  └─ Yes  →  BieberWorks.SDK.Core         (pulls SharedKernel automatically)

Am I building a module with a PostgreSQL DbContext?
  └─ Yes  →  BieberWorks.SDK.Core.Postgres (no ASP.NET Core dependency)

Am I registering Minimal API endpoints or controllers?
  └─ Yes  →  BieberWorks.SDK.Core.Web     (pulls Core + SharedKernel)

Am I building the host (Program.cs / WebApplication)?
  └─ Yes  →  BieberWorks.SDK.Core.Web     (contains AddBieberWorksModules,
                                           MapBieberWorksModules,
                                           InitializeBieberWorksModulesAsync)
```

> **NuGet Reference Range:** Internal module references to Foundation float with `0.*-*`, so RC packages are resolved automatically.

## Documentation

| Topic | File |
|---|---|
| SharedKernel types reference | [shared-kernel.md](shared-kernel.md) |
| IModule system and host setup | [imodule.md](imodule.md) |
| Messaging (dispatcher, commands, events) | [messaging.md](messaging.md) |
| Core.Postgres (transactions, outbox, Npgsql) | [core-postgres.md](core-postgres.md) |
| GDPR data-subject contracts | [gdpr-data-subject-contracts.md](gdpr-data-subject-contracts.md) |
| Localization (layered, culture endpoint) | [localization.md](localization.md) |
| Blazor route-override system | [routing.md](routing.md) |
| Changelog | [CHANGES.md](CHANGES.md) |
