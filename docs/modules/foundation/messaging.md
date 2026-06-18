# Messaging

Das Messaging-System entkoppelt Fach-Logik von ihren Aufrufern. Ein Aufrufer schickt ein Command oder eine Query an den `IAppMessageDispatcher`. Dieser leitet die Nachricht an den registrierten Handler weiter. Der Handler gibt ein `Result` zurück, das optional Domain-Events enthält. Der Dispatcher veröffentlicht diese Events automatisch über den `IDomainEventPublisher`, der alle `IDomainEventProcessor<T>`-Implementierungen aufruft.

## Konzept

```
Aufrufer
  │
  │  dispatcher.SendAsync(command)
  ▼
IAppMessageDispatcher (InternalDispatcher)
  │
  │  handler.HandleAsync(command)
  ▼
IAppMessageRequestHandler<TCommand, TResult>
  │
  │  return Result.Success(domainEvents: [...])
  ▼
IDomainEventPublisher
  │
  │  processor.HandleAsync(event)
  ▼
IDomainEventProcessor<TEvent>   (z.B. AuditableEventHandler, EmailNotificationProcessor, …)
```

## Interfaces

### IAppMessageRequest&lt;TResponse&gt;

Basis-Marker für alle Nachrichten:

```csharp
public interface IAppMessageRequest<TResponse> { }
```

### IAppMessageCommand / IAppMessageCommand&lt;TResponse&gt;

Commands verändern Zustand und geben `Result` oder `Result<T>` zurück:

```csharp
public interface IAppMessageCommand
    : IAppMessageRequest<Result> { }

public interface IAppMessageCommand<TResponse>
    : IAppMessageRequest<Result<TResponse>> { }
```

### IAppMessageQuery&lt;TResponse&gt;

Queries lesen Daten und geben `Result<T>` zurück:

```csharp
public interface IAppMessageQuery<TResponse>
    : IAppMessageRequest<Result<TResponse>> { }
```

### IAppMessageRequestHandler&lt;TCommand, TResponse&gt;

Der Handler für eine Nachricht:

```csharp
public interface IAppMessageRequestHandler<TCommand, TResponse>
    where TCommand : IAppMessageRequest<TResponse>
{
    Task<TResponse> HandleAsync(TCommand command, CancellationToken ct);
}
```

### IAppMessageDispatcher

Der Einstiegspunkt für Aufrufer:

```csharp
public interface IAppMessageDispatcher
{
    Task<TResponse> SendAsync<TResponse>(
        IAppMessageRequest<TResponse> command,
        CancellationToken ct = default);
}
```

### IDomainEventPublisher

Veröffentlicht Events an alle registrierten Processor-Handler:

```csharp
public interface IDomainEventPublisher
{
    Task PublishAsync(IDomainEvent domainEvent, CancellationToken ct = default);
    Task PublishManyAsync(IEnumerable<IDomainEvent> domainEvents, CancellationToken ct = default);
}
```

::: info Wann IDomainEventPublisher direkt nutzen?
Direkte Services, die **nicht** über den Dispatcher aufgerufen werden (z.B. `RoleManagementService`, `UserManagementService`), müssen `IDomainEventPublisher` selbst injizieren und `PublishAsync` manuell aufrufen. Der Dispatcher übernimmt die Veröffentlichung nur für Handler, die er selbst aufruft.
:::

### IDomainEventProcessor&lt;TEvent&gt;

Ein Processor reagiert auf einen bestimmten Event-Typ:

```csharp
public interface IDomainEventProcessor<in TEvent>
    where TEvent : IDomainEvent
{
    Task HandleAsync(TEvent domainEvent, CancellationToken ct = default);
}
```

## Messaging registrieren

```csharp
// In Program.cs
builder.Services.AddBieberWorksMessaging();
```

Das registriert `IDomainEventPublisher` und `IAppMessageDispatcher` als **Scoped**, damit sie in Request-Scopes korrekt funktionieren und Scoped-Services (z.B. `DbContext`) ohne Captive-Dependency-Fehler auflösen können.

## End-to-End-Beispiel

### 1. Command definieren

```csharp
using BieberWorks.SDK.Core.Messaging;
using BieberWorks.SDK.SharedKernel.Results;

public record RegisterUserCommand(string Email, string Password)
    : IAppMessageCommand<Guid>;
```

### 2. Domain-Event definieren

```csharp
using BieberWorks.SDK.SharedKernel;

public record UserRegistered(Guid UserId, string Email)
    : IAuditableEvent
{
    public string  AuditAction     => "auth:user:registered";
    public string  AuditResource   => "User";
    public string? AuditResourceId => UserId.ToString();
    public string? AuditUserId     => null;
    public string? AuditDetails    => $"Email: {Email}";
}
```

### 3. Handler implementieren

```csharp
using BieberWorks.SDK.Core.Messaging;
using BieberWorks.SDK.SharedKernel.Results;

public sealed class RegisterUserCommandHandler(IUserRepository users)
    : IAppMessageRequestHandler<RegisterUserCommand, Result<Guid>>
{
    public async Task<Result<Guid>> HandleAsync(
        RegisterUserCommand command,
        CancellationToken ct)
    {
        if (await users.ExistsByEmailAsync(command.Email, ct))
            return DomainError.Conflict("User.EmailTaken", "E-Mail bereits vergeben.");

        var user = User.Create(command.Email, command.Password);
        await users.AddAsync(user, ct);

        return Result.Success<Guid>(
            user.Id,
            domainEvents: [new UserRegistered(user.Id, command.Email)]);
    }
}
```

### 4. Handler in der Module.cs registrieren

```csharp
services.AddScoped<
    IAppMessageRequestHandler<RegisterUserCommand, Result<Guid>>,
    RegisterUserCommandHandler>();
```

### 5. Processor implementieren (optional)

```csharp
using BieberWorks.SDK.Core.Messaging;

public sealed class WelcomeEmailProcessor(IEmailService email)
    : IDomainEventProcessor<UserRegistered>
{
    public async Task HandleAsync(UserRegistered domainEvent, CancellationToken ct)
    {
        await email.SendWelcomeAsync(domainEvent.Email, ct);
    }
}
```

Registrierung in `Module.cs`:

```csharp
services.AddScoped<IDomainEventProcessor<UserRegistered>, WelcomeEmailProcessor>();
```

### 6. Aufrufen

```csharp
// In einem Minimal-API-Endpoint oder einer Blazor-Komponente
var result = await dispatcher.SendAsync(
    new RegisterUserCommand(email, password), ct);

if (!result.Success)
    return Results.UnprocessableEntity(result.Errors);

return Results.Ok(result.Value);
```

::: tip Open-Generic-Handler für Auto-Auditing
SDK-Audit registriert `AuditableEventHandler<TEvent>` als Open-Generic:
```csharp
services.AddScoped(typeof(IDomainEventProcessor<>), typeof(AuditableEventHandler<>));
```
Jeder Event, der `IAuditableEvent` implementiert, wird damit automatisch geloggt — ohne Registrierung im Fachmodul.
:::

::: warning Handler nicht gefunden
Wenn kein `IAppMessageRequestHandler<TCommand, TResponse>` im DI-Container registriert ist, wirft `InternalDispatcher` eine `InvalidOperationException`. Sicherstellen, dass Handler in `RegisterServices` des zugehörigen Moduls eingetragen sind.
:::
