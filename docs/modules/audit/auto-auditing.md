# Auto-Auditing

## How it works

SDK-Audit uses the messaging mechanism from SDK-Foundation to automatically intercept domain events:

1. A domain module publishes a domain event (e.g., via `IDomainEventPublisher.PublishAsync` or as a return value from a command handler with `Result.Success(..., domainEvents: [...])`).
2. The Foundation infrastructure (`DomainEventPublisher`) resolves all registered `IDomainEventProcessor<TEvent>`.
3. If the event implements `IAuditableEvent`, the open-generic handler `AuditableEventHandler<TEvent>` kicks in.
4. The handler calls `IAuditService.LogAsync` and persists the entry in the `audit` schema.

```
Domain event (implements IAuditableEvent)
        │
        ▼
DomainEventPublisher (Foundation)
        │
        ▼
AuditableEventHandler<TEvent>   ← Open-generic, automatically resolved
        │
        ▼
IAuditService.LogAsync
        │
        ▼
AuditDbContext → PostgreSQL schema "audit"
```

::: info No audit code in the domain module
The triggering module (e.g. SDK-Auth) needs no audit logic. It is sufficient for the domain event to implement `IAuditableEvent`. SDK-Audit does not know the event at compile time — MS.DI resolves the handler via reflection at runtime.
:::

## IAuditableEvent

`IAuditableEvent` lives in `BieberWorks.SDK.SharedKernel` and inherits from `IDomainEvent`:

```csharp
public interface IAuditableEvent : IDomainEvent
{
    /// <summary>Verb describing the audited action, e.g. "auth:user:registered".</summary>
    string AuditAction { get; }

    /// <summary>Type of the affected resource, e.g. "User".</summary>
    string AuditResource { get; }

    /// <summary>ID of the affected resource instance; null if not applicable.</summary>
    string? AuditResourceId { get; }

    /// <summary>Identity of the actor; null for system-generated events.</summary>
    string? AuditUserId { get; }

    /// <summary>Optional free text or JSON with additional context.</summary>
    string? AuditDetails { get; }
}
```

## Making a domain event auditable

Simply implement `IAuditableEvent`. The event needs no reference to `BieberWorks.SDK.Audit` or `BieberWorks.SDK.Audit.Contracts` — only to `BieberWorks.SDK.SharedKernel`.

### Complete example

Suppose a module `SDK-Forum` wants to record post creation in the audit log:

```csharp
using BieberWorks.SDK.SharedKernel;

namespace BieberWorks.SDK.Forum.Contracts.Events;

/// <summary>
/// Fired when a new post is created.
/// Implements IAuditableEvent so SDK-Audit automatically logs the action.
/// </summary>
public sealed record PostCreatedEvent(
    Guid PostId,
    string Title,
    string AuthorId) : IAuditableEvent
{
    // IAuditableEvent properties
    public string  AuditAction     => "forum:post:created";
    public string  AuditResource   => "Post";
    public string? AuditResourceId => PostId.ToString();
    public string? AuditUserId     => AuthorId;
    public string? AuditDetails    => $"Title: {Title}";
}
```

Once this event is published via the `IDomainEventPublisher`, SDK-Audit automatically writes the following entry:

| Field | Value (example) |
|---|---|
| `UserId` | `"user-123"` |
| `Action` | `"forum:post:created"` |
| `Resource` | `"Post"` |
| `ResourceId` | `"post-456"` |
| `Details` | `"Title: My first post"` |
| `Timestamp` | UTC timestamp at handler execution time |

::: tip Convention for AuditAction
Recommended format: `<module>:<resource>:<verb>`, e.g. `auth:user:registered`, `forum:post:deleted`. This enables targeted filtering in the admin UI.
:::

## What is automatically logged

Every domain event implementing `IAuditableEvent` and published via Foundation's `DomainEventPublisher` lands automatically in the audit log. This includes:

- Events returned by a command handler as part of its `Result.Success(...)` (Foundation dispatcher extracts them).
- Events published directly via `IDomainEventPublisher.PublishAsync(domainEvent)` or `PublishManyAsync(events)`.

::: warning Direct service calls
Services called directly from the UI (without the `IAppMessageDispatcher`) must inject `IDomainEventPublisher` themselves and call `PublishAsync`. Without this call, the event never reaches `AuditableEventHandler`.
:::
