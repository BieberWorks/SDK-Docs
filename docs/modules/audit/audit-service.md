# IAuditService

`IAuditService` ist das öffentliche Service-Interface aus `BieberWorks.SDK.Audit.Contracts`. Andere Module können es referenzieren, ohne die Implementierungsassembly zu kennen.

## Interface

```csharp
public interface IAuditService
{
    /// <summary>Persistiert einen Audit-Eintrag.</summary>
    Task LogAsync(AuditEntry entry, CancellationToken ct = default);

    /// <summary>Gibt eine seitenweise, gefilterte Liste von Audit-Einträgen zurück.</summary>
    Task<PagedResult<AuditEntryDto>> GetAsync(AuditFilter filter, CancellationToken ct = default);

    /// <summary>
    /// Gibt distinkte, sortierte Werte für Action und Resource zurück.
    /// Wird verwendet, um die Multiselect-Filter-Dropdowns in der Admin-UI zu befüllen.
    /// </summary>
    Task<AuditFacets> GetFacetsAsync(CancellationToken ct = default);

    /// <summary>Löscht den Audit-Eintrag mit der angegebenen ID. Gibt false zurück, wenn nicht gefunden.</summary>
    Task<bool> DeleteAsync(Guid id, CancellationToken ct = default);
}
```

## AuditEntry (Eingabe für LogAsync)

```csharp
public sealed record AuditEntry(
    string?         UserId,       // Akteur; null bei systemgenerierten Events
    string          Action,       // Verb, z.B. "auth:user:registered"
    string          Resource,     // Ressourcentyp, z.B. "User"
    string?         ResourceId  = null,  // ID der Ressource-Instanz
    string?         Details     = null,  // JSON oder Freitext
    DateTimeOffset? Timestamp   = null); // UTC; Standard: DateTimeOffset.UtcNow
```

## AuditEntryDto (Ausgabe von GetAsync)

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

## AuditFilter (Parameter für GetAsync)

Alle Felder sind optional. Gesetzte Felder werden mit AND verknüpft.

```csharp
public sealed record AuditFilter(
    int                     Page       = 1,
    int                     PageSize   = 50,
    string?                 UserId     = null,  // case-insensitiver contains-Match
    IReadOnlyList<string>?  Resources  = null,  // exakter IN-Filter
    DateTimeOffset?         From       = null,  // inklusiv
    DateTimeOffset?         To         = null,  // inklusiv
    string?                 Search     = null,  // Freitext-OR über alle Spalten
    IReadOnlyList<string>?  Actions    = null,  // exakter IN-Filter
    string?                 ResourceId = null); // case-insensitiver contains-Match
```

### Filterverhalten im Detail

| Parameter | Typ | Verhalten |
|---|---|---|
| `UserId` | contains | Case-insensitiv, partieller Match (z.B. `"user"` trifft `"user-123"`) |
| `Resources` | IN-Filter | Exakter Match auf `Resource`-Spalte; mehrere Werte werden per OR verknüpft |
| `Actions` | IN-Filter | Exakter Match auf `Action`-Spalte; mehrere Werte werden per OR verknüpft |
| `From` / `To` | Range | Inklusive Grenzen auf `Timestamp` |
| `Search` | Freitext | Case-insensitiver OR-Match über `UserId`, `Action`, `Resource`, `ResourceId`, `Details` |
| `ResourceId` | contains | Case-insensitiv, partieller Match |

::: info PostgreSQL ILike
Auf PostgreSQL nutzt die Implementierung `EF.Functions.ILike` für alle contains- und Freitextsuchen — Index-freundlich und nativ case-insensitiv. Auf anderen Providern (z.B. InMemory für Tests) wird auf `ToLower().Contains()` zurückgefallen.
:::

## AuditFacets (Ausgabe von GetFacetsAsync)

```csharp
public sealed record AuditFacets(
    IReadOnlyList<string> Actions,    // distinct, sortiert
    IReadOnlyList<string> Resources); // distinct, sortiert
```

Wird von der Admin-UI verwendet, um die Dropdown-Filter mit realen Datenbankwerten zu befüllen.

## PagedResult\<T\>

```csharp
public sealed record PagedResult<T>(
    IReadOnlyList<T> Items,
    int              Total,
    int              Page,
    int              PageSize);
```

## Direkte Nutzung

`IAuditService` kann in jeden Service oder Handler injiziert werden, der `Audit.Contracts` referenziert:

```csharp
public class MyService(IAuditService audit)
{
    public async Task DoSomethingAsync(string userId, CancellationToken ct)
    {
        // ... Geschäftslogik ...

        await audit.LogAsync(new AuditEntry(
            UserId:     userId,
            Action:     "mymodule:something:done",
            Resource:   "Something",
            ResourceId: "resource-42",
            Details:    "Optionaler Kontext"), ct);
    }
}
```

::: tip Auto-Auditing bevorzugen
Direktes `LogAsync` ist nur notwendig, wenn kein Domain-Event publiziert werden kann. Für die meisten Fälle ist [Auto-Auditing via IAuditableEvent](./auto-auditing.md) die bevorzugte Methode — kein Boilerplate, keine direkte Abhängigkeit auf `Audit.Contracts`.
:::

## Audit-Logs abfragen

```csharp
// Neueste 20 Einträge für einen bestimmten Benutzer
var result = await auditService.GetAsync(new AuditFilter(
    Page:     1,
    PageSize: 20,
    UserId:   "user-123"), ct);

Console.WriteLine($"Gesamt: {result.Total}");
foreach (var entry in result.Items)
{
    Console.WriteLine($"{entry.Timestamp:u}  {entry.Action}  {entry.Resource}/{entry.ResourceId}");
}

// Alle "delete"-Aktionen auf "User"-Ressourcen in einem Zeitraum
var deleteResult = await auditService.GetAsync(new AuditFilter(
    Actions:   ["user:delete", "auth:user:deleted"],
    Resources: ["User"],
    From:      DateTimeOffset.UtcNow.AddDays(-7),
    To:        DateTimeOffset.UtcNow), ct);
```

## REST-Endpunkte

Das Modul registriert drei Endpunkte unter `/api/audit`. Alle erfordern Autorisierung.

| Methode | Pfad | Berechtigung | Beschreibung |
|---|---|---|---|
| `GET` | `/api/audit` | `audit:logs:read` | Paginierte, gefilterte Liste |
| `GET` | `/api/audit/facets` | `audit:logs:read` | Distinkte Actions und Resources |
| `DELETE` | `/api/audit/{id}` | `audit:logs:delete` | Einzelnen Eintrag löschen |

### GET /api/audit — Query-Parameter

```
GET /api/audit?page=1&pageSize=50&userId=user-123&resource=User,Role&action=created&from=2026-01-01T00:00:00Z&search=admin
```

`resource` und `action` akzeptieren kommagetrennte Werte für den IN-Filter.

## Berechtigungen

`AuditPermissions` definiert zwei Berechtigungs-Konstanten:

```csharp
public sealed class AuditPermissions : IPermissionContributor
{
    public const string LogsRead   = "audit:logs:read";
    public const string LogsDelete = "audit:logs:delete";
}
```

Sie werden automatisch beim Start über `IPermissionContributor` im Auth-Modul registriert, wenn SDK-Auth und SDK-Audit gemeinsam verwendet werden.
