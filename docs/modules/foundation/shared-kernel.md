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

`ISingletonEntity` is a pure marker interface (no members) for entities that must exist exactly once in the database — the "singleton entity" pattern.

**Why member-less?** The entity's primary key type and value are already provided by `EntityBase` (`Guid Id`). Declaring an `int Id` member on the marker would conflict with the `Guid` key from the base class and serve no purpose. The marker's sole role is intent-tagging, which requires no members.

**Why only a marker?** SharedKernel is intentionally dependency-free. An EF Core Fluent API helper (`HasSingletonConstraint()`) would require an EF Core `PackageReference`, which violates the dependency-free principle. The database-level enforcement belongs in the consuming module's `DbContext`.

### Implementation

Because SDK entities derive from `EntityBase` (which provides `Guid Id`), identify the singleton row with a well-known `Guid` constant rather than an integer:

```csharp
public class AppConfig : EntityBase, ISingletonEntity
{
    // Well-known identifier — fixed, never generated at runtime
    public static readonly Guid SingletonId =
        new("00000000-0000-0000-0000-000000000001");

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
    b.ToTable(t => t.HasCheckConstraint(
        "CK_AppConfig_SingletonId",
        $"\"Id\" = '{AppConfig.SingletonId}'"));

    // Seed the single row so it is always present after migration
    b.HasData(new AppConfig { Id = AppConfig.SingletonId, Theme = "light" });
});
```

> **Note:** Adjust the quoted identifier style (`"Id"` vs `Id`) to match your database provider's quoting rules. PostgreSQL uses double quotes; SQL Server uses brackets (`[Id]`).

The check constraint name follows the convention `CK_{TableName}_SingletonId`.

## IEntity and EntityBase

`IEntity` is the root marker for all domain entities:

```csharp
public interface IEntity
{
    Guid Id { get; set; }
}
```

`EntityBase` is the abstract base class for entities. It provides a Version 7 UUID primary key (time-sortable) and a UTC creation timestamp:

```csharp
public abstract class EntityBase : IEntity
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
```

All SDK module entities derive from `EntityBase`. Do not set `Id` manually — `Guid.CreateVersion7()` produces a time-ordered UUID that is safe for database indexing.

## IRepository&lt;T&gt; and IUnitOfWork

`IRepository<T>` is a generic CRUD abstraction for domain entities. Modules implement their own concrete repositories against this contract:

```csharp
public interface IRepository<T> where T : IEntity
{
    Task<Result> AddAsync(T obj, CancellationToken ct);
    Task<Result> UpdateAsync(T obj, CancellationToken ct);
    Task<Result> DeleteAsync(T obj, CancellationToken ct);
    Task<Result<T>> GetAsync(Guid id, CancellationToken ct);
    Task<Result<T>> GetByIdAsync(Guid id, CancellationToken ct);
    Task<Result<IEnumerable<T>>> GetAllAsync(CancellationToken ct);
}
```

`IUnitOfWork` is the minimal persistence-flush contract:

```csharp
public interface IUnitOfWork
{
    Task<Result> SaveChangesAsync(CancellationToken ct);
}
```

Neither interface has an EF Core dependency. The EF Core implementation is the responsibility of each consuming module's `DbContext`.

## ValidationError

`ValidationError` is a specialisation of `DomainError` that aggregates multiple validation errors into one:

```csharp
public record ValidationError(IEnumerable<DomainError> Errors)
    : DomainError("General.Validation", DomainErrorType.Validation,
                  "One or more validation errors occurred.");
```

The static factory `ValidationError.FromResults` collects all errors from a sequence of failed `Result` objects:

```csharp
var combined = ValidationError.FromResults([result1, result2, result3]);
```

## IDomainErrorLocalizer

`IDomainErrorLocalizer` is the contract for presenting a human-readable message for a given `DomainError`. Modules that expose user-facing error strings implement this interface:

```csharp
public interface IDomainErrorLocalizer
{
    string GetLocalizedMessage(DomainError domainError);
}
```

Register your implementation as `Scoped` and inject it wherever error messages must be translated before display.

## ITranslationStore (SharedKernel.Localization)

`ITranslationStore` is the contract between the SharedKernel localization layer and any DB-backed translation module (e.g. SDK-Localization). It is consumed by `LayeredStringLocalizerFactory` in `Core.Web` to override `.resx` strings at runtime:

```csharp
namespace BieberWorks.SDK.SharedKernel.Localization;

public interface ITranslationStore
{
    Task<string?> GetAsync(string resourceType, string key, string culture,
                           CancellationToken ct = default);
}
```

If no implementation is registered, the localization layer falls back transparently to `.resx`. See [localization.md](localization.md) for the full layered setup.

## GDPR Data-Subject Contracts

`BieberWorks.SDK.SharedKernel` also contains the cross-module interfaces for GDPR data-export and erasure: `IUserDataExporter`, `IUserDataEraser`, `IUserDataErasureImpactProvider`, and the accompanying records and enums (`ErasureMode`, `ErasureImpactSeverity`, `UserAccountDeletionRequestedEvent`).

See [gdpr-data-subject-contracts.md](gdpr-data-subject-contracts.md) for the full reference, registration pattern, and implementation example.
