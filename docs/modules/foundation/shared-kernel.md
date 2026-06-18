# SharedKernel

Das Paket `BieberWorks.SDK.SharedKernel` hat keine externen NuGet-Abhängigkeiten. Es enthält ausschließlich Interfaces, Records und Enums, auf die alle anderen Pakete aufbauen.

## IDomainEvent

```csharp
namespace BieberWorks.SDK.SharedKernel;

public interface IDomainEvent { }
```

`IDomainEvent` ist ein reines Marker-Interface. Ein Domain-Event signalisiert, dass im System etwas Bedeutsames passiert ist. Implementierungen werden als Records modelliert und über `IDomainEventPublisher` veröffentlicht.

**Wann implementieren:** Immer, wenn ein Modul Seiteneffekte in anderen Modulen anstoßen soll, ohne eine direkte Abhängigkeit einzuführen.

```csharp
public record UserRegistered(Guid UserId, string Email) : IDomainEvent;
```

## IAuditableEvent

```csharp
public interface IAuditableEvent : IDomainEvent
{
    string  AuditAction     { get; }   // z.B. "auth:user:registered"
    string  AuditResource   { get; }   // z.B. "User"
    string? AuditResourceId { get; }   // ID der betroffenen Ressource; null wenn nicht anwendbar
    string? AuditUserId     { get; }   // Akteur; null bei System-Events
    string? AuditDetails    { get; }   // Freitext oder JSON mit Zusatzkontext
}
```

`IAuditableEvent` erweitert `IDomainEvent` und aktiviert das automatische Audit-Logging. SDK-Audit registriert einen Open-Generic-Handler `AuditableEventHandler<TEvent>`, der jeden Event, der dieses Interface implementiert, ohne weiteren Code im Fachmodul in den Audit-Log schreibt.

::: tip Auto-Auditing ohne Abhängigkeit
Ein Fachmodul muss SDK-Audit **nicht** referenzieren. Solange der Event `IAuditableEvent` implementiert und SDK-Audit im Host registriert ist, wird der Audit-Eintrag automatisch erzeugt.
:::

```csharp
public record UserRegistered(Guid UserId, string Email)
    : IAuditableEvent
{
    public string  AuditAction     => "auth:user:registered";
    public string  AuditResource   => "User";
    public string? AuditResourceId => UserId.ToString();
    public string? AuditUserId     => null;   // System-initiiert
    public string? AuditDetails    => $"Email: {Email}";
}
```

## Result / Result&lt;T&gt;

```csharp
public record Result(
    bool Success,
    IEnumerable<DomainError>? Errors = default,
    IEnumerable<IDomainEvent>? DomainEvents = default);

public record Result<TValue>(
    TValue? Value,
    bool Success,
    IEnumerable<DomainError>? Errors = default,
    IEnumerable<IDomainEvent>? DomainEvents = default)
    : Result(Success, Errors, DomainEvents);
```

### Factory-Methoden (C# 14 Extension-Members)

Die statischen Factory-Methoden sind als C# 14 Extension-Methoden auf `Result` definiert:

| Methode | Rückgabe | Beschreibung |
|---|---|---|
| `Result.Success(domainEvents?)` | `Result` | Erfolg ohne Wert |
| `Result.Success<T>(value, domainEvents?)` | `Result<T>` | Erfolg mit Wert |
| `Result.Failure(error)` | `Result` | Fehler ohne Wert |
| `Result.Failure<T>(error)` | `Result<T>` | Fehler mit Typ-Parameter |

### Implizite Konvertierungen

```csharp
// DomainError → Result (Fehlerfall)
Result result = DomainError.NotFound("User.NotFound");

// TValue → Result<T> (Erfolgsfall, null wird zu NullValue-Fehler)
Result<User> result = user;

// DomainError → Result<T> (Fehlerfall)
Result<User> result = DomainError.Unauthorized("User.Unauthorized");
```

### DomainEvents in Result

Handler geben Domain-Events direkt im Result zurück. `InternalDispatcher` liest die `DomainEvents`-Property nach dem Handler-Aufruf und veröffentlicht sie automatisch.

```csharp
return Result.Success(domainEvents: [new UserRegistered(user.Id, user.Email)]);
```

### Bind / BindAsync

```csharp
// Synchron
Result<string> nameResult = userResult.Bind(u => Result.Success(u.Name));

// Asynchron (Task-basiert)
Result<Profile> profileResult = await userResultTask
    .BindAsync(u => LoadProfileAsync(u.Id));
```

::: warning Bind schlägt bei null fehl
`Result<T>.Bind` gibt `DomainError.Unexpected` zurück wenn `result.Success == false`. Der Wert wird nicht ausgewertet.
:::

## DomainError

```csharp
public record DomainError(
    string Code,
    DomainErrorType Type = DomainErrorType.Failure,
    string? Message = null);
```

### Vordefinierte statische Instanzen

| Member | Type | Code | Beschreibung |
|---|---|---|---|
| `DomainError.None` | — | `""` | Kein Fehler (Erfolgsfall) |
| `DomainError.NullValue` | `Failure` | `"General.Null"` | Null-Wert unzulässig |
| `DomainError.Unexpected` | `Unexpected` | `"General.Unexpected"` | Unerwarteter Fehler |
| `DomainError.Canceled` | `Unexpected` | `"General.Canceled"` | Operation abgebrochen |

### Factory-Methoden

```csharp
DomainError.NotFound("User.NotFound", "Der Benutzer wurde nicht gefunden.")
DomainError.Validation("User.EmailInvalid", "Ungültige E-Mail-Adresse.")
DomainError.Failure("User.SaveFailed")
DomainError.Conflict("User.EmailTaken")
DomainError.Forbidden("User.NoPermission")
DomainError.Unauthorized("User.NotLoggedIn")
DomainError.BadRequest("Request.MalformedBody")
DomainError.TooManyRequests("Auth.RateLimited")
```

### DomainErrorType

```csharp
public enum DomainErrorType
{
    Unexpected      = 0,
    Failure         = 1,
    Validation      = 2,
    NotFound        = 3,
    Conflict        = 4,
    Unauthorized    = 5,
    Forbidden       = 6,
    BadRequest      = 7,
    TooManyRequests = 8
}
```

Der `Type` wird von der Präsentationsschicht genutzt, um den HTTP-Statuscode abzuleiten (z.B. `NotFound` → 404, `Validation` → 422).

### IDomainError

`IDomainError` ist das Interface hinter `DomainError` und kann für Abstraktionen verwendet werden:

```csharp
public interface IDomainError
{
    string Code { get; }
    string? Message { get; }
    DomainErrorType Type { get; }
}
```
