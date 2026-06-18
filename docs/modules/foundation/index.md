# Foundation

Foundation ist das Fundament aller BieberWorks SDK-Module. Es stellt die abhängigkeitsfreien Basistypen (SharedKernel), das Modul-System mit DI-Integration (Core) sowie die ASP.NET Core-Anbindung (Core.Web) bereit. Kein Fachmodul enthält Framework-Abhängigkeiten, die nicht in diese drei Pakete gehören. Alle anderen Module hängen von Foundation ab — niemals umgekehrt.

## Pakete

| Paket | Beschreibung | Version |
|---|---|---|
| `BieberWorks.SDK.SharedKernel` | Abhängigkeitsfreie Basistypen: `IDomainEvent`, `IAuditableEvent`, `Result`/`Result<T>`, `DomainError` | ![v0.3.0](https://img.shields.io/badge/version-0.3.0-blue) |
| `BieberWorks.SDK.Core` | Modul-System (`IModule`, Discovery, DI-Registrierung) + Messaging (`IAppMessageDispatcher`, `IDomainEventPublisher`, `IDomainEventProcessor<T>`) | ![v0.3.0](https://img.shields.io/badge/version-0.3.0-blue) |
| `BieberWorks.SDK.Core.Web` | ASP.NET Core-Integration: `IEndpointModule`, `AddBieberWorksModules`, `MapBieberWorksModules`, `InitializeBieberWorksModulesAsync`, geschichtete Lokalisierung | ![v0.3.0](https://img.shields.io/badge/version-0.3.0-blue) |

## Abhängigkeitsgraph

```
BieberWorks.SDK.Core.Web
  └── BieberWorks.SDK.Core
        └── BieberWorks.SDK.SharedKernel   (keine externen Abhängigkeiten)
```

Fachmodule (Auth, Audit, Storage, …) referenzieren je nach Bedarf:

- `BieberWorks.SDK.SharedKernel` — für `IDomainEvent`, `IAuditableEvent`, `Result`, `DomainError`
- `BieberWorks.SDK.Core` — für `IModule`, Messaging-Interfaces
- `BieberWorks.SDK.Core.Web` — wenn das Modul HTTP-Endpoints oder die Lokalisierungs-Schicht braucht

## Wann welches Paket installieren

```
Brauche ich nur Result / DomainError / IDomainEvent?
  └─ Ja  →  BieberWorks.SDK.SharedKernel

Implementiere ich ein Modul (IModule) oder nutze ich den Dispatcher?
  └─ Ja  →  BieberWorks.SDK.Core         (zieht SharedKernel automatisch mit)

Registriere ich Minimal-API-Endpoints oder Controller?
  └─ Ja  →  BieberWorks.SDK.Core.Web     (zieht Core + SharedKernel mit)

Baue ich den Host (Program.cs / WebApplication)?
  └─ Ja  →  BieberWorks.SDK.Core.Web     (enthält AddBieberWorksModules,
                                           MapBieberWorksModules,
                                           InitializeBieberWorksModulesAsync)
```

::: tip NuGet-Referenz-Bereich
Interne Modul-Referenzen auf Foundation floaten mit `0.*-*`, damit RC-Pakete automatisch aufgelöst werden.
:::
