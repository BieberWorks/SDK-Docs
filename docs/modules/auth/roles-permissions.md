# Rollen & Permissions

## Rollen-Modell

Das Modul verwendet ASP.NET Core Identity-Rollen (`ApplicationRole`). Vordefinierte Rollennamen sind in `Roles` (aus `Auth.Contracts`) als Konstanten hinterlegt:

```csharp
public readonly record struct Roles
{
    public const string Admin = "Admin";
    public const string Customer = "Customer";
}
```

Rollen werden beim Start durch `PermissionStartupTasks` automatisch in der Datenbank angelegt, falls sie noch nicht vorhanden sind. Der Startup-Task läuft als Teil von `InitializeBieberWorksModulesAsync()`.

## Permission-System

### Konzept

Permissions sind feinkörnige Berechtigungen, die Rollen zugewiesen werden. Ein Benutzer erhält eine Permission, wenn er einer Rolle angehört, der diese Permission zugewiesen wurde.

Der Schlüssel einer Permission folgt dem Format `{modul}:{ressource}:{aktion}`, z. B. `auth:users:read`.

### Permissions definieren (IPermissionContributor)

Jedes Modul, das eigene Permissions bereitstellen möchte, implementiert `IPermissionContributor` und registriert sich als Singleton:

```csharp
// In einem eigenen Modul:
public sealed class MyModulePermissionContributor : IPermissionContributor
{
    public IEnumerable<PermissionDefinition> GetPermissions()
    {
        yield return new PermissionDefinition(
            Key: "mymodule:orders:read",
            DisplayName: "Bestellungen anzeigen",
            Module: "MyModule",
            Group: "Bestellungen");

        yield return new PermissionDefinition(
            Key: "mymodule:orders:manage",
            DisplayName: "Bestellungen verwalten",
            Module: "MyModule",
            Group: "Bestellungen",
            Description: "Erstellen, bearbeiten und stornieren von Bestellungen");
    }
}

// In der Modul-Registrierung:
services.AddSingleton<IPermissionContributor, MyModulePermissionContributor>();
```

`IPermissionService.GetCatalog()` gibt alle registrierten Permissions aller Module zurück.

### Auth-eigene Permissions

Das Auth-Modul stellt folgende Permissions bereit (`AuthPermissions`):

| Schlüssel | Beschreibung |
|---|---|
| `auth:users:read` | Benutzerliste und -details anzeigen |
| `auth:users:manage` | Benutzer sperren/entsperren, Rollen zuweisen |
| `auth:roles:read` | Rollenliste und -details anzeigen |
| `auth:roles:manage` | Rollen erstellen, bearbeiten, löschen, Permissions zuweisen |

### Permissions prüfen

#### In Minimal-API-Endpoints

```csharp
app.MapGet("/api/orders", HandleAsync)
   .RequirePermission("mymodule:orders:read");
```

Die Extension-Methode `RequirePermission` (aus `Auth`) erzeugt eine Policy mit dem Namen `perm:{key}`.

#### In Razor-Komponenten / Seiten

```razor
@attribute [Authorize(Policy = "perm:auth:users:read")]
```

oder mit dem `RequiresPermissionAttribute`:

```csharp
[RequiresPermission("auth:users:read")]
public class MyAdminPage : ComponentBase { }
```

Das Attribut generiert automatisch den Policy-Namen `perm:{key}` und ist mit `IAuthorizeData` kompatibel.

#### Programmatisch

```csharp
public class MyService(IPermissionService permissionService)
{
    public async Task DoSomethingAsync(ClaimsPrincipal user)
    {
        if (!await permissionService.HasPermissionAsync(user, "mymodule:orders:manage"))
            throw new UnauthorizedAccessException();

        // ...
    }
}
```

### IPermissionService

```csharp
public interface IPermissionService
{
    Task<bool> HasPermissionAsync(ClaimsPrincipal user, string permissionKey, CancellationToken ct = default);
    Task<IReadOnlySet<string>> GetEffectivePermissionsAsync(ClaimsPrincipal user, CancellationToken ct = default);
    IReadOnlyList<PermissionDefinition> GetCatalog();
    void Invalidate();  // Cache leeren nach Rollen-/Permission-Änderungen
}
```

`IPermissionService` ist als **Singleton** registriert und cached die effektiven Permissions pro Benutzer im Arbeitsspeicher. Nach einer Änderung an Rollen oder Permission-Zuweisungen muss `Invalidate()` aufgerufen werden — `RoleManagementService` erledigt das automatisch.

## Rollen-Verwaltung (IRoleManagementService)

`IRoleManagementService` ist der zentrale Einstiegspunkt für programmatische Rollen-Verwaltung:

```csharp
public interface IRoleManagementService
{
    Task<IReadOnlyList<RoleSummaryDto>> GetRolesAsync(CancellationToken ct = default);
    Task<RoleDetailDto?> GetRoleAsync(string roleId, CancellationToken ct = default);
    Task<RoleDetailDto> CreateRoleAsync(CreateRoleRequest request, CancellationToken ct = default);
    Task<RoleDetailDto> UpdateRoleAsync(string roleId, UpdateRoleRequest request, CancellationToken ct = default);
    Task DeleteRoleAsync(string roleId, CancellationToken ct = default);
    Task SetRolePermissionsAsync(string roleId, IEnumerable<string> permissionKeys, CancellationToken ct = default);
}
```

::: warning Systemrollen
`Admin` und `Customer` sind Systemrollen. Das Umbenennen und Löschen von Systemrollen wirft eine `InvalidOperationException`. Die Permission-Zuweisung ist jedoch auch für Systemrollen möglich.
:::

## User-Management (IUserManagementService)

`IUserManagementService` (aus `Auth.Contracts`) wird vom `UserManagementModule` registriert und ist nicht im Kern-`AuthModule` enthalten:

```csharp
// Verfügbar wenn UserManagementModule registriert ist
public interface IUserManagementService
{
    Task<IReadOnlyList<UserSummaryDto>> GetUsersAsync(CancellationToken ct = default);
    Task<UserDetailDto?> GetUserAsync(string userId, CancellationToken ct = default);
    Task SetUserLockedAsync(string userId, bool locked, CancellationToken ct = default);
    Task SetUserRolesAsync(string userId, IReadOnlyList<string> roles, CancellationToken ct = default);
}
```

### Admin-REST-Endpunkte

Das `UserManagementModule` mappt folgende Endpunkte (alle erfordern die entsprechende Permission):

| Methode | Pfad | Permission |
|---|---|---|
| `GET` | `/api/admin/users` | `auth:users:read` |
| `GET` | `/api/admin/users/{userId}` | `auth:users:read` |
| `PUT` | `/api/admin/users/{userId}/lock` | `auth:users:manage` |
| `PUT` | `/api/admin/users/{userId}/roles` | `auth:users:manage` |

## Domain-Events

Das Auth-Modul veröffentlicht folgende Domain-Events (alle in `Auth.Contracts.DomainEvents`):

| Event | Auslöser |
|---|---|
| `UserRegisteredEvent` | Erfolgreiche Registrierung |
| `UserLoggedInEvent` | Erfolgreicher Login |
| `EmailConfirmationRequestedEvent` | Registrierung oder erneutes Senden |
| `PasswordResetRequestedEvent` | Passwort-vergessen-Anfrage |
| `PasswordChangedEvent` | Passwort-Änderung oder -Reset |
| `TokenRefreshedEvent` | Token-Refresh |
| `RoleCreatedEvent` | Neue Rolle erstellt |
| `RoleUpdatedEvent` | Rolle aktualisiert |
| `RoleDeletedEvent` | Rolle gelöscht |
| `UserLockStateChangedEvent` | Benutzer gesperrt/entsperrt |

::: tip Auto-Auditing
Events, die `IAuditableEvent` implementieren, werden automatisch vom `SDK-Audit`-Modul protokolliert — ohne jeglichen Auth-seitigen Audit-Code.
:::
