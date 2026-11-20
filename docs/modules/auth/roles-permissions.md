# Roles & Permissions

## Role Model

The module uses ASP.NET Core Identity roles (`ApplicationRole`). Predefined role names are stored as constants in `Roles` (from `Auth.Contracts`):

```csharp
public readonly record struct Roles
{
    public const string Admin = "Admin";
    public const string Customer = "Customer";
}
```

Roles are automatically created in the database on startup via `PermissionStartupTasks` if they don't exist yet. The startup task runs as part of `InitializeBieberWorksModulesAsync()`.

## Permission System

### Concept

Permissions are fine-grained authorizations assigned to roles. A user gets a permission if they belong to a role that has been assigned that permission.

The key of a permission follows the format `{module}:{resource}:{action}`, e.g. `auth:users:read`.

### Defining Permissions (IPermissionContributor)

Each module that wants to provide custom permissions implements `IPermissionContributor` and registers itself as a singleton:

```csharp
// In your own module:
public sealed class MyModulePermissionContributor : IPermissionContributor
{
    public IEnumerable<PermissionDefinition> GetPermissions()
    {
        yield return new PermissionDefinition(
            Key: "mymodule:orders:read",
            DisplayName: "View orders",
            Module: "MyModule",
            Group: "Orders");

        yield return new PermissionDefinition(
            Key: "mymodule:orders:manage",
            DisplayName: "Manage orders",
            Module: "MyModule",
            Group: "Orders",
            Description: "Create, edit, and cancel orders");
    }
}

// In module registration:
services.AddSingleton<IPermissionContributor, MyModulePermissionContributor>();
```

`IPermissionService.GetCatalog()` returns all registered permissions of all modules.

### Auth-specific permissions

The Auth module provides the following permissions (`AuthPermissions`):

| Key | Description |
|---|---|
| `auth:users:read` | View user list and details |
| `auth:users:manage` | Lock/unlock users, assign roles |
| `auth:roles:read` | View role list and details |
| `auth:roles:manage` | Create, edit, delete roles, assign permissions |

### Checking permissions

#### In Minimal API endpoints

```csharp
app.MapGet("/api/orders", HandleAsync)
   .RequirePermission("mymodule:orders:read");
```

The `RequirePermission` extension method (from `Auth`) creates a policy with the name `perm:{key}`.

#### In Razor components / pages

```razor
@attribute [Authorize(Policy = "perm:auth:users:read")]
```

or with the `RequiresPermissionAttribute`:

```csharp
[RequiresPermission("auth:users:read")]
public class MyAdminPage : ComponentBase { }
```

The attribute automatically generates the policy name `perm:{key}` and is compatible with `IAuthorizeData`.

#### Programmatically

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
    void Invalidate();  // Clear cache after role / permission changes
}
```

`IPermissionService` is registered as a **singleton** and caches effective permissions per user in memory. After changing roles or permission assignments, `Invalidate()` must be called — `RoleManagementService` does this automatically.

## Role Management (IRoleManagementService)

`IRoleManagementService` is the central entry point for programmatic role management:

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

::: warning System Roles
`Admin` and `Customer` are system roles. Renaming and deleting system roles throws an `InvalidOperationException`. Permission assignment is allowed for system roles.
:::

## User Management (IUserManagementService)

`IUserManagementService` (from `Auth.Contracts`) is registered by the `UserManagementModule` and is not included in the core `AuthModule`:

```csharp
// Available when UserManagementModule is registered
public interface IUserManagementService
{
    Task<IReadOnlyList<UserSummaryDto>> GetUsersAsync(CancellationToken ct = default);
    Task<UserDetailDto?> GetUserAsync(string userId, CancellationToken ct = default);
    Task SetUserLockedAsync(string userId, bool locked, CancellationToken ct = default);
    Task SetUserRolesAsync(string userId, IReadOnlyList<string> roles, CancellationToken ct = default);
}
```

### Admin REST endpoints

The `UserManagementModule` maps the following endpoints (all require the appropriate permission):

| Method | Path | Permission |
|---|---|---|
| `GET` | `/api/admin/users` | `auth:users:read` |
| `GET` | `/api/admin/users/{userId}` | `auth:users:read` |
| `PUT` | `/api/admin/users/{userId}/lock` | `auth:users:manage` |
| `PUT` | `/api/admin/users/{userId}/roles` | `auth:users:manage` |

## Domain Events

The Auth module publishes the following domain events (all in `Auth.Contracts.DomainEvents`):

| Event | Trigger |
|---|---|
| `UserRegisteredEvent` | Successful registration |
| `UserLoggedInEvent` | Successful login |
| `EmailConfirmationRequestedEvent` | Registration or resend |
| `PasswordResetRequestedEvent` | Forgot password request |
| `PasswordChangedEvent` | Password change or reset |
| `TokenRefreshedEvent` | Token refresh |
| `RoleCreatedEvent` | New role created |
| `RoleUpdatedEvent` | Role updated |
| `RoleDeletedEvent` | Role deleted |
| `UserLockStateChangedEvent` | User locked/unlocked |

::: tip Auto-Auditing
Events implementing `IAuditableEvent` are automatically logged by the `SDK-Audit` module — without any audit code on the Auth side.
:::
