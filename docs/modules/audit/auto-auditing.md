# Auto-Auditing

## Wie es funktioniert

SDK-Audit nutzt den Messaging-Mechanismus von SDK-Foundation, um Domain-Events automatisch abzufangen:

1. Ein Fachmodul publiziert ein Domain-Event (z.B. über `IDomainEventPublisher.PublishAsync` oder als Rückgabe eines Command-Handlers mit `Result.Success(..., domainEvents: [...])`).
2. Die Foundation-Infrastruktur (`DomainEventPublisher`) löst alle registrierten `IDomainEventProcessor<TEvent>` auf.
3. Wenn das Event `IAuditableEvent` implementiert, greift der Open-Generic-Handler `AuditableEventHandler<TEvent>`.
4. Der Handler ruft `IAuditService.LogAsync` auf und persistiert den Eintrag im Schema `audit`.

```
Domain-Event (implementiert IAuditableEvent)
        │
        ▼
DomainEventPublisher (Foundation)
        │
        ▼
AuditableEventHandler<TEvent>   ← Open-Generic, automatisch aufgelöst
        │
        ▼
IAuditService.LogAsync
        │
        ▼
AuditDbContext → PostgreSQL Schema "audit"
```

::: info Kein Audit-Code im Fachmodul
Das auslösende Modul (z.B. SDK-Auth) muss keinerlei Audit-Logik enthalten. Es genügt, dass das Domain-Event `IAuditableEvent` implementiert. SDK-Audit kennt das Event nicht zur Compile-Zeit — MS.DI löst den Handler per Reflection zur Laufzeit auf.
:::

## IAuditableEvent

`IAuditableEvent` lebt in `BieberWorks.SDK.SharedKernel` und erbt von `IDomainEvent`:

```csharp
public interface IAuditableEvent : IDomainEvent
{
    /// <summary>Verb, der die geprüfte Aktion beschreibt, z.B. "auth:user:registered".</summary>
    string AuditAction { get; }

    /// <summary>Typ der betroffenen Ressource, z.B. "User".</summary>
    string AuditResource { get; }

    /// <summary>ID der betroffenen Ressource-Instanz; null wenn nicht anwendbar.</summary>
    string? AuditResourceId { get; }

    /// <summary>Identität des Akteurs; null bei systemgenerierten Events.</summary>
    string? AuditUserId { get; }

    /// <summary>Optionaler Freitext oder JSON mit zusätzlichem Kontext.</summary>
    string? AuditDetails { get; }
}
```

## Ein Domain-Event auditfähig machen

Es reicht aus, `IAuditableEvent` zu implementieren. Das Event benötigt keine Referenz auf `BieberWorks.SDK.Audit` oder `BieberWorks.SDK.Audit.Contracts` — nur auf `BieberWorks.SDK.SharedKernel`.

### Vollständiges Beispiel

Angenommen, ein Modul `SDK-Forum` möchte das Erstellen eines Beitrags im Audit-Log festhalten:

```csharp
using BieberWorks.SDK.SharedKernel;

namespace BieberWorks.SDK.Forum.Contracts.Events;

/// <summary>
/// Wird ausgelöst, wenn ein neuer Beitrag erstellt wurde.
/// Implementiert IAuditableEvent, damit SDK-Audit den Vorgang automatisch protokolliert.
/// </summary>
public sealed record PostCreatedEvent(
    Guid PostId,
    string Title,
    string AuthorId) : IAuditableEvent
{
    // IAuditableEvent-Properties
    public string  AuditAction     => "forum:post:created";
    public string  AuditResource   => "Post";
    public string? AuditResourceId => PostId.ToString();
    public string? AuditUserId     => AuthorId;
    public string? AuditDetails    => $"Title: {Title}";
}
```

Sobald dieses Event über den `IDomainEventPublisher` veröffentlicht wird, schreibt SDK-Audit automatisch folgenden Eintrag:

| Feld | Wert (Beispiel) |
|---|---|
| `UserId` | `"user-123"` |
| `Action` | `"forum:post:created"` |
| `Resource` | `"Post"` |
| `ResourceId` | `"post-456"` |
| `Details` | `"Title: Mein erster Beitrag"` |
| `Timestamp` | UTC-Zeitstempel zum Zeitpunkt des Handlers |

::: tip Konvention für AuditAction
Empfohlenes Format: `<modul>:<ressource>:<verb>`, z.B. `auth:user:registered`, `forum:post:deleted`. Das ermöglicht gezielte Filterung in der Admin-UI.
:::

## Was wird automatisch geloggt

Jedes Domain-Event, das `IAuditableEvent` implementiert und über den Foundation-`DomainEventPublisher` publiziert wird, landet automatisch im Audit-Log. Dazu zählen:

- Events, die ein Command-Handler als Teil seines `Result.Success(...)` zurückgibt (Foundation-Dispatcher extrahiert sie).
- Events, die direkt über `IDomainEventPublisher.PublishAsync(domainEvent)` oder `PublishManyAsync(events)` veröffentlicht werden.

::: warning Direkte Service-Calls
Services, die direkt von der UI aufgerufen werden (ohne den `IAppMessageDispatcher`), müssen `IDomainEventPublisher` selbst injizieren und `PublishAsync` aufrufen. Ohne diesen Aufruf erreicht das Event den `AuditableEventHandler` nicht.
:::
