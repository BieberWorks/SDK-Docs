# Messaging

The messaging system decouples business logic from its callers. A caller sends a command or query to the `IAppMessageDispatcher`. The dispatcher forwards the message to the registered handler. The handler returns a `Result` that optionally contains domain events. The dispatcher publishes these events automatically via the `IDomainEventPublisher`, which calls all `IDomainEventProcessor<T>` implementations.

## Concept

```
Caller
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
IDomainEventProcessor<TEvent>   (e.g., AuditableEventHandler, EmailNotificationProcessor, …)
```

## Interfaces

### IAppMessageRequest&lt;TResponse&gt;

Base marker for all messages:

```csharp
public interface IAppMessageRequest<TResponse> { }
```

### IAppMessageCommand / IAppMessageCommand&lt;TResponse&gt;

Commands change state and return `Result` or `Result<T>`:

```csharp
public interface IAppMessageCommand
    : IAppMessageRequest<Result> { }

public interface IAppMessageCommand<TResponse>
    : IAppMessageRequest<Result<TResponse>> { }
```

### IAppMessageQuery&lt;TResponse&gt;

Queries read data and return `Result<T>`:

```csharp
public interface IAppMessageQuery<TResponse>
    : IAppMessageRequest<Result<TResponse>> { }
```

### IAppMessageRequestHandler&lt;TCommand, TResponse&gt;

The handler for a message:

```csharp
public interface IAppMessageRequestHandler<TCommand, TResponse>
    where TCommand : IAppMessageRequest<TResponse>
{
    Task<TResponse> HandleAsync(TCommand command, CancellationToken ct);
}
```

### IAppMessageDispatcher

The entry point for callers:

```csharp
public interface IAppMessageDispatcher
{
    Task<TResponse> SendAsync<TResponse>(
        IAppMessageRequest<TResponse> command,
        CancellationToken ct = default);
}
```

### IDomainEventPublisher

Publishes events to all registered processor handlers:

```csharp
public interface IDomainEventPublisher
{
    Task PublishAsync(IDomainEvent domainEvent, CancellationToken ct = default);
    Task PublishManyAsync(IEnumerable<IDomainEvent> domainEvents, CancellationToken ct = default);
}
```

::: info When to Use IDomainEventPublisher Directly?
Direct services that are **not** called via the dispatcher (e.g., `RoleManagementService`, `UserManagementService`) must inject `IDomainEventPublisher` themselves and call `PublishAsync` manually. The dispatcher only publishes events for handlers it calls itself.
:::

### IDomainEventProcessor&lt;TEvent&gt;

A processor reacts to a specific event type:

```csharp
public interface IDomainEventProcessor<in TEvent>
    where TEvent : IDomainEvent
{
    Task HandleAsync(TEvent domainEvent, CancellationToken ct = default);
}
```

## Registering Messaging

```csharp
// In Program.cs
builder.Services.AddBieberWorksMessaging();
```

This registers `IDomainEventPublisher` and `IAppMessageDispatcher` as **Scoped**, so they work correctly in request scopes and can resolve scoped services (e.g., `DbContext`) without captive dependency errors.

## End-to-End Example

### 1. Define the Command

```csharp
using BieberWorks.SDK.Core.Messaging;
using BieberWorks.SDK.SharedKernel.Results;

public record RegisterUserCommand(string Email, string Password)
    : IAppMessageCommand<Guid>;
```

### 2. Define the Domain Event

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

### 3. Implement the Handler

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
            return DomainError.Conflict("User.EmailTaken", "Email already taken.");

        var user = User.Create(command.Email, command.Password);
        await users.AddAsync(user, ct);

        return Result.Success<Guid>(
            user.Id,
            domainEvents: [new UserRegistered(user.Id, command.Email)]);
    }
}
```

### 4. Register the Handler in Module.cs

```csharp
services.AddScoped<
    IAppMessageRequestHandler<RegisterUserCommand, Result<Guid>>,
    RegisterUserCommandHandler>();
```

### 5. Implement a Processor (optional)

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

Register in `Module.cs`:

```csharp
services.AddScoped<IDomainEventProcessor<UserRegistered>, WelcomeEmailProcessor>();
```

### 6. Call It

```csharp
// In a Minimal API endpoint or Blazor component
var result = await dispatcher.SendAsync(
    new RegisterUserCommand(email, password), ct);

if (!result.Success)
    return Results.UnprocessableEntity(result.Errors);

return Results.Ok(result.Value);
```

::: tip Open-Generic Handler for Auto-Auditing
SDK-Audit registers `AuditableEventHandler<TEvent>` as open-generic:
```csharp
services.AddScoped(typeof(IDomainEventProcessor<>), typeof(AuditableEventHandler<>));
```
Every event implementing `IAuditableEvent` is logged automatically — without registration in the domain module.
:::

::: warning Handler Not Found
If no `IAppMessageRequestHandler<TCommand, TResponse>` is registered in the DI container, `InternalDispatcher` throws `InvalidOperationException`. Ensure the handler is registered in `RegisterServices` of the associated module.
:::
