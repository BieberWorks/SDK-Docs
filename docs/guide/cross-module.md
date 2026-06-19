# Cross-Module Integration

This guide explains how BieberWorks SDK modules interact at runtime — dependency direction, event flow, extension points, and the rules that keep modules decoupled.

## Dependency Direction

Foundation is the only shared base. All other modules depend on Foundation; Foundation depends on nothing domain-specific.

```
SharedKernel  (no external dependencies)
  └── Core
        └── Core.Web
              └── Auth, Audit, Email, UI, Admin, Localization,
                  Storage, Account, Settings, Notifications
```

Fachmodule may additionally reference `Auth.Contracts` for `ICurrentUserProvider` or `IPermissionContributor` — but never the `Auth` implementation package.

**Rule:** Module A must never reference the implementation package of Module B. Only `*.Contracts` packages cross module boundaries. The host references all implementation packages and wires them together.

## No DB-JOIN Rule

Each module has its own `DbContext` and PostgreSQL schema. Cross-module data access happens only via:

- **IDs** (pass user IDs, resource IDs as strings/GUIDs)
- **Domain events** (published through the Foundation messaging pipeline)
- **Contracts interfaces** (inject `ICurrentUserProvider` from Auth.Contracts, for example)

Never access another module's `DbContext` directly. Never JOIN across schemas.

## Messaging: IAppMessageDispatcher vs. Direct Service Calls

| Approach | When to use | Event publishing |
|---|---|---|
| `IAppMessageDispatcher.SendAsync(command)` | Commands/queries via registered handlers | Automatic — events from `Result.DomainEvents` are published |
| Direct service call | Services called from UI or other services | Manual — inject `IDomainEventPublisher` and call `PublishAsync` |

## Event Flow Example

User registration triggers automatic side effects across modules — none coupled to each other:

```
Auth.RegisterUserCommandHandler
  → Result.Success(domainEvents: [UserRegisteredEvent, UserRegisteredEmailEvent])
    → InternalDispatcher extracts DomainEvents
      → DomainEventPublisher.PublishManyAsync (Foundation)
          ├── AuditableEventHandler<UserRegisteredEvent>    (SDK-Audit, open-generic — automatic)
          ├── NotifiableEventHandler<UserRegisteredEvent>   (SDK-Notifications, open-generic — if loaded)
          └── EmailConfirmationRequestedEventHandler        (SDK-Auth, for UserRegisteredEmailEvent)
```

`AuditableEventHandler<TEvent>` and `NotifiableEventHandler<TEvent>` are registered via open-generic DI. Any event implementing `IAuditableEvent` or `INotifiableEvent` is captured automatically — the originating module contains zero audit or notification code.

## Extension Points

| Extension Point | Interface | Registration | Provided by |
|---|---|---|---|
| Admin nav section | `IAdminSection` | `services.AddSingleton<IAdminSection, MySection>()` | SDK-Admin.Contracts |
| Account nav section | `IAccountSection` | `services.AddSingleton<IAccountSection, MySection>()` | SDK-Account.Contracts |
| AppBar widget | `IAppBarWidget` | `services.AddSingleton<IAppBarWidget>(new MyWidget())` | SDK-UI.Contracts |
| Permission definition | `IPermissionContributor` | `services.AddSingleton<IPermissionContributor, MyContributor>()` | SDK-Auth.Contracts |
| Email template | `IEmailTemplateProvider` | `services.TryAddEnumerable(ServiceDescriptor.Singleton<IEmailTemplateProvider>(...))` | SDK-Email.Contracts |
| Notification target | `INotificationTargetResolver<T>` | `services.AddScoped<INotificationTargetResolver<T>, MyResolver>()` | SDK-Notifications.Contracts |

All are discovered at runtime via `IEnumerable<T>` enumeration — the consuming module has no compile-time knowledge of which implementations exist.

## IAuditableEvent — Automatic Cross-Module Auditing

```csharp
// In MyModule.Contracts — no reference to SDK-Audit
public record ItemDeletedEvent(string ItemId, string DeletedByUserId)
    : IDomainEvent, IAuditableEvent
{
    public string AuditAction     => "ItemDeleted";
    public string AuditResource   => "Item";
    public string AuditResourceId => ItemId;
    public string AuditUserId     => DeletedByUserId;
    public string? AuditDetails   => null;
}
```

When SDK-Audit is installed, it captures this. When it is not installed, the event flows with no side effect.

## INotifiableEvent — Automatic Notification Pipeline

```csharp
public record ItemSharedEvent(string ItemId, string SharedWithUserId)
    : IDomainEvent, INotifiableEvent;
```

Register an `INotificationTargetResolver<ItemSharedEvent>` and SDK-Notifications handles delivery via configured channels.

## Shared Database, Separate Schemas

All modules can use the same PostgreSQL database instance. Each module's `__EFMigrationsHistory` is in its own schema — isolated, independently versioned.

See [Migrations — Per-Schema Isolation](/guide/migrations#per-schema-isolation) for connection string details.

## UI Assembly Discovery

`AddBwModuleAssemblies(typeof(Program).Assembly)` scans all loaded assemblies matching `BieberWorks.SDK.*.MudBlazor` and registers their Razor components. It also filters SDK `@page` routes that conflict with host routes (host wins).

Adding a new `*.UI.MudBlazor` NuGet package to the host `.csproj` is sufficient — no explicit `AddAdditionalAssemblies(...)` call needed.
