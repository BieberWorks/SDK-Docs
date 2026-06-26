# IAuditService

`IAuditService` is the public service interface from `BieberWorks.SDK.Audit.Contracts`. Other modules can reference it without knowing the implementation assembly.

## Interface

```csharp
public interface IAuditService
{
    /// <summary>Persists an audit entry.</summary>
    Task LogAsync(AuditEntry entry, CancellationToken ct = default);

    /// <summary>Returns a paginated, filtered list of audit entries.</summary>
    Task<PagedResult<AuditEntryDto>> GetAsync(AuditFilter filter, CancellationToken ct = default);

    /// <summary>
    /// Returns distinct, sorted values for action and resource.
    /// Used to populate multi-select filter dropdowns in the admin UI.
    /// </summary>
    Task<AuditFacets> GetFacetsAsync(CancellationToken ct = default);

    /// <summary>Deletes the audit entry with the specified ID. Returns false if not found.</summary>
    Task<bool> DeleteAsync(Guid id, CancellationToken ct = default);
}
```

## AuditEntry (input for LogAsync)

```csharp
public sealed record AuditEntry(
    string?         UserId,       // Actor; null for system-generated events
    string          Action,       // Verb, e.g. "auth:user:registered"
    string          Resource,     // Resource type, e.g. "User"
    string?         ResourceId  = null,  // ID of the resource instance
    string?         Details     = null,  // JSON or free text
    DateTimeOffset? Timestamp   = null); // UTC; default: DateTimeOffset.UtcNow
```

## AuditEntryDto (output from GetAsync)

```csharp
public sealed record AuditEntryDto(
    Guid            Id,
    string?         UserId,
    string          Action,
    string          Resource,
    string?         ResourceId,
    string?         Details,
    DateTimeOffset  Timestamp);
```

## AuditFilter (parameter for GetAsync)

All fields are optional. Set fields are combined with AND.

```csharp
public sealed record AuditFilter(
    int                     Page       = 1,
    int                     PageSize   = 50,
    string?                 UserId     = null,  // case-insensitive contains-match
    IReadOnlyList<string>?  Resources  = null,  // exact IN filter
    DateTimeOffset?         From       = null,  // inclusive
    DateTimeOffset?         To         = null,  // inclusive
    string?                 Search     = null,  // free text OR across all columns
    IReadOnlyList<string>?  Actions    = null,  // exact IN filter
    string?                 ResourceId = null); // case-insensitive contains-match
```

### Filter behavior in detail

| Parameter | Type | Behavior |
|---|---|---|
| `UserId` | contains | Case-insensitive, partial match (e.g. `"user"` matches `"user-123"`) |
| `Resources` | IN filter | Exact match on `Resource` column; multiple values are combined with OR |
| `Actions` | IN filter | Exact match on `Action` column; multiple values are combined with OR |
| `From` / `To` | Range | Inclusive limits on `Timestamp` |
| `Search` | Free text | Case-insensitive OR match across `UserId`, `Action`, `Resource`, `ResourceId`, `Details` |
| `ResourceId` | contains | Case-insensitive, partial match |

::: info PostgreSQL ILike
On PostgreSQL, the implementation uses `EF.Functions.ILike` for all contains and free text searches — index-friendly and natively case-insensitive. On other providers (e.g. InMemory for tests), falls back to `ToLower().Contains()`.
:::

## AuditFacets (output from GetFacetsAsync)

```csharp
public sealed record AuditFacets(
    IReadOnlyList<string> Actions,    // distinct, sorted
    IReadOnlyList<string> Resources); // distinct, sorted
```

Used by the admin UI to populate the dropdown filters with real database values.

## PagedResult\<T\>

```csharp
public sealed record PagedResult<T>(
    IReadOnlyList<T> Items,
    int              Total,
    int              Page,
    int              PageSize);
```

## Direct usage

`IAuditService` can be injected into any service or handler that references `Audit.Contracts`:

```csharp
public class MyService(IAuditService audit)
{
    public async Task DoSomethingAsync(string userId, CancellationToken ct)
    {
        // ... business logic ...

        await audit.LogAsync(new AuditEntry(
            UserId:     userId,
            Action:     "mymodule:something:done",
            Resource:   "Something",
            ResourceId: "resource-42",
            Details:    "Optional context"), ct);
    }
}
```

::: tip Prefer auto-auditing
Direct `LogAsync` is only necessary when a domain event cannot be published. For most cases, [auto-auditing via IAuditableEvent](./auto-auditing.md) is the preferred method — no boilerplate, no direct dependency on `Audit.Contracts`.
:::

## Query audit logs

```csharp
// Latest 20 entries for a specific user
var result = await auditService.GetAsync(new AuditFilter(
    Page:     1,
    PageSize: 20,
    UserId:   "user-123"), ct);

Console.WriteLine($"Total: {result.Total}");
foreach (var entry in result.Items)
{
    Console.WriteLine($"{entry.Timestamp:u}  {entry.Action}  {entry.Resource}/{entry.ResourceId}");
}

// All "delete" actions on "User" resources in a time range
var deleteResult = await auditService.GetAsync(new AuditFilter(
    Actions:   ["user:delete", "auth:user:deleted"],
    Resources: ["User"],
    From:      DateTimeOffset.UtcNow.AddDays(-7),
    To:        DateTimeOffset.UtcNow), ct);
```

## REST endpoints

The module registers three endpoints under `/api/audit`. All require authorization.

| Method | Path | Permission | Description |
|---|---|---|---|
| `GET` | `/api/audit` | `audit:logs:read` | Paginated, filtered list |
| `GET` | `/api/audit/facets` | `audit:logs:read` | Distinct actions and resources |
| `DELETE` | `/api/audit/{id}` | `audit:logs:delete` | Delete single entry |

### GET /api/audit — query parameters

```
GET /api/audit?page=1&pageSize=50&userId=user-123&resource=User,Role&action=created&resourceId=post-42&from=2026-01-01T00:00:00Z&search=admin
```

`resource` and `action` accept comma-separated values for the IN filter. `resourceId` is a case-insensitive contains-match on the `ResourceId` column.

## Permissions

`AuditPermissions` defines two permission constants:

```csharp
public sealed class AuditPermissions : IPermissionContributor
{
    public const string LogsRead   = "audit:logs:read";
    public const string LogsDelete = "audit:logs:delete";
}
```

They are automatically registered on startup via `IPermissionContributor` in the Auth module when SDK-Auth and SDK-Audit are used together.

## GDPR / Personal-Data Handling

SDK-Audit registers two GDPR providers automatically (no additional setup required):

| Provider | Interface | Behaviour |
|---|---|---|
| `AuditUserDataExporter` | `IUserDataExporter` | Returns all audit entries for the requested user as a JSON array, ordered by timestamp. |
| `AuditUserDataEraser` | `IUserDataEraser` | Replaces the `UserId` column with the tombstone value `"ERASED"` for all matching rows. The rows themselves are **never deleted** — audit records are forensic evidence. The operation is idempotent. |

::: info Erasure mode is ignored
`AuditUserDataEraser` always anonymises regardless of the `ErasureMode` requested (hard delete vs. anonymise). This is intentional: audit trails must be retained for compliance.
:::
