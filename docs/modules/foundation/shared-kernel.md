# SharedKernel

The package `BieberWorks.SDK.SharedKernel` has no external NuGet dependencies. It contains only interfaces, records, and enums that all other packages build upon.

## IDomainEvent

```csharp
namespace BieberWorks.SDK.SharedKernel;

public interface IDomainEvent { }
```

`IDomainEvent` is a pure marker interface. A domain event signals that something significant has happened in the system. Implementations are modeled as records and published via `IDomainEventPublisher`.

**When to implement:** Always, when a module should trigger side effects in other modules without introducing a direct dependency.

```csharp
public record UserRegistered(Guid UserId, string Email) : IDomainEvent;
```

## IAuditableEvent

```csharp
public interface IAuditableEvent : IDomainEvent
{
    string  AuditAction     { get; }   // e.g., "auth:user:registered"
    string  AuditResource   { get; }   // e.g., "User"
    string? AuditResourceId { get; }   // ID of the affected resource; null if not applicable
    string? AuditUserId     { get; }   // Actor; null for system events
    string? AuditDetails    { get; }   // Free text or JSON with additional context
}
```

`IAuditableEvent` extends `IDomainEvent` and activates automatic audit logging. SDK-Audit registers an open-generic handler `AuditableEventHandler<TEvent>` that writes any event implementing this interface to the audit log without additional code in the domain module.

::: tip Auto-Auditing Without Dependency
A domain module does **not** need to reference SDK-Audit. As long as the event implements `IAuditableEvent` and SDK-Audit is registered in the host, the audit entry is created automatically.
:::

```csharp
public record UserRegistered(Guid UserId, string Email)
    : IAuditableEvent
{
    public string  AuditAction     => "auth:user:registered";
    public string  AuditResource   => "User";
    public string? AuditResourceId => UserId.ToString();
    public string? AuditUserId     => null;   // System-initiated
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

### Factory Methods (C# 14 Extension Members)

The static factory methods are defined as C# 14 extension members on `Result`:

| Method | Returns | Description |
|---|---|---|
| `Result.Success(domainEvents?)` | `Result` | Success without value |
| `Result.Success<T>(value, domainEvents?)` | `Result<T>` | Success with value |
| `Result.Failure(error)` | `Result` | Error without value |
| `Result.Failure<T>(error)` | `Result<T>` | Error with type parameter |

### Implicit Conversions

```csharp
// DomainError → Result (error case)
Result result = DomainError.NotFound("User.NotFound");

// TValue → Result<T> (success case, null becomes NullValue error)
Result<User> result = user;

// DomainError → Result<T> (error case)
Result<User> result = DomainError.Unauthorized("User.Unauthorized");
```

### DomainEvents in Result

Handlers return domain events directly in the result. `InternalDispatcher` reads the `DomainEvents` property after the handler call and publishes them automatically.

```csharp
return Result.Success(domainEvents: [new UserRegistered(user.Id, user.Email)]);
```

### Bind / BindAsync

```csharp
// Synchronous
Result<string> nameResult = userResult.Bind(u => Result.Success(u.Name));

// Asynchronous (Task-based)
Result<Profile> profileResult = await userResultTask
    .BindAsync(u => LoadProfileAsync(u.Id));
```

::: warning Bind Fails on Null
`Result<T>.Bind` returns `DomainError.Unexpected` if `result.Success == false`. The value is not evaluated.
:::

## DomainError

```csharp
public record DomainError(
    string Code,
    DomainErrorType Type = DomainErrorType.Failure,
    string? Message = null);
```

### Predefined Static Instances

| Member | Type | Code | Description |
|---|---|---|---|
| `DomainError.None` | — | `""` | No error (success case) |
| `DomainError.NullValue` | `Failure` | `"General.Null"` | Null value not allowed |
| `DomainError.Unexpected` | `Unexpected` | `"General.Unexpected"` | Unexpected error |
| `DomainError.Canceled` | `Unexpected` | `"General.Canceled"` | Operation canceled |

### Factory Methods

```csharp
DomainError.NotFound("User.NotFound", "The user was not found.")
DomainError.Validation("User.EmailInvalid", "Invalid email address.")
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

The `Type` is used by the presentation layer to derive the HTTP status code (e.g., `NotFound` → 404, `Validation` → 422).

### IDomainError

`IDomainError` is the interface behind `DomainError` and can be used for abstractions:

```csharp
public interface IDomainError
{
    string Code { get; }
    string? Message { get; }
    DomainErrorType Type { get; }
}
```

## LocalizedText

`LocalizedText` is an immutable, culture-open in-memory value object that holds multilingual text and resolves it via a three-tier fallback strategy.

**Design principle:** `LocalizedText` has **no EF Core or persistence dependency**. Mapping it to the database (e.g. as a JSON column or a companion translation table) is the responsibility of the consuming module's `DbContext`.

### Fallback Strategy

Resolution is attempted in this order:

1. **Exact match** — e.g. `"de-AT"` finds `"de-AT"` directly.
2. **Language-only match** — e.g. `"de-CH"` falls back to `"de"` when `"de-CH"` is absent.
3. **Language-prefix scan** — e.g. `"de-CH"` falls back to `"de-AT"` when only a regional variant exists.
4. **First available** — any stored translation when nothing else matches.
5. `null` when the instance is empty.

### Usage

```csharp
// Inline construction via tuple factory
var title = LocalizedText.From(("en", "Welcome"), ("de", "Willkommen"));

// Resolve with an explicit culture name
string? text = title.Get("de");            // "Willkommen"
string? text = title.Get("de-CH");         // "Willkommen" (language fallback)

// Resolve via the current user's ILanguageService (injected in your component/service)
string? text = title.Get(languageService); // uses languageService.CurrentCulture

// Resolve via CultureInfo
string? text = title.Get(CultureInfo.CurrentUICulture);

// Non-throwing TryGet variant
if (title.TryGet("fr", out var french))
    Console.WriteLine(french);

// Dictionary-based construction (useful when loading from a DB or config)
var descriptions = new Dictionary<string, string>
{
    ["en"] = "A great product",
    ["de"] = "Ein tolles Produkt",
};
var desc = new LocalizedText(descriptions);
```

### Persisting LocalizedText (consumer DbContext responsibility)

SharedKernel contains no EF Core dependency. Choose a persistence strategy in your module's `DbContext`:

**Option A — JSON column (single row)**

```csharp
// In OnModelCreating:
builder.Property(e => e.Title)
    .HasConversion(
        v => JsonSerializer.Serialize(v, null as JsonSerializerOptions),
        v => JsonSerializer.Deserialize<LocalizedText>(v, null as JsonSerializerOptions)!
    )
    .HasColumnType("jsonb"); // PostgreSQL; use "nvarchar(max)" / "text" for others
```

**Option B — companion translation table (1:n)**

```csharp
// Separate PageTranslation entity with Culture + Text columns;
// reconstruct LocalizedText after loading:
var text = new LocalizedText(
    translations.ToDictionary(t => t.Culture, t => t.Text));
```

## ISingletonEntity

`ISingletonEntity` is a marker interface for entities that must exist exactly once in the database — the "singleton entity" pattern where `Id = 1` is enforced by a check constraint.

**Why only a marker?** SharedKernel is intentionally dependency-free. An EF Core Fluent API helper (`HasSingletonConstraint()`) would require an EF Core `PackageReference`, which violates the federleichter Kern principle. Three lines of EF Core configuration do not justify that coupling.

### Implementation

```csharp
public class AppConfig : ISingletonEntity
{
    public int Id { get; set; } = 1;
    public string Theme { get; set; } = "light";
    // ... other settings
}
```

### EF Core Convention Snippet (copy into your module's DbContext)

```csharp
// In OnModelCreating (or an IEntityTypeConfiguration<AppConfig>):
modelBuilder.Entity<AppConfig>(b =>
{
    // Enforce exactly one row at the database level
    b.ToTable(t => t.HasCheckConstraint("CK_AppConfig_SingletonId", "\"Id\" = 1"));

    // Seed the single row so it is always present after migration
    b.HasData(new AppConfig { Id = 1, Theme = "light" });
});
```

> **Note:** Adjust the quoted identifier style (`"Id"` vs `Id`) to match your database provider's quoting rules. PostgreSQL uses double quotes; SQL Server uses brackets (`[Id]`).

The check constraint name follows the convention `CK_{TableName}_SingletonId`.
