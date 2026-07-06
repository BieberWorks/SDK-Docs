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

`IPermissionContributor`, `PermissionDefinition`, and `IPermissionService` live in the Tier-0
package `BieberWorks.SDK.Core.Authorization`, namespace `BieberWorks.SDK.Core.Authorization`
(not in `Auth.Contracts`; `Auth.Contracts` only holds the `AuthPermissions` constants).

Each module that wants to provide custom permissions implements `IPermissionContributor` and
registers itself via the `AddPermissionContributor<T>()` extension:

```csharp
// In your own module:
using BieberWorks.SDK.Core.Authorization;

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
services.AddPermissionContributor<MyModulePermissionContributor>();
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

`IPermissionService` is also defined in `BieberWorks.SDK.Core.Authorization`:

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

### Registration (v3.0.0+): AddBieberWorksAuthorization()

As of Auth v3.0.0, the `IPermissionService` implementation and its authorization policy
provider/handler live entirely in `BieberWorks.SDK.Core.Authorization` and are registered via
the `AddBieberWorksAuthorization()` extension. `AuthModule.RegisterServices` calls this
extension itself, so existing Auth-only hosts require **no code change**.

Hosts that run **SDK-ApiKeys without SDK-Auth** (the primary motivation for this move — M2M
authorization without a full Identity/Auth module) must call `AddBieberWorksAuthorization()`
themselves, since no `AuthModule` is present to do it for them:

```csharp
services.AddBieberWorksAuthorization();
```

Role-based permission resolution is provided through the new `IRolePermissionSource`
abstraction (Tier 0, `BieberWorks.SDK.Core.Authorization`). It is **optional** — a host without
any registered `IRolePermissionSource` still gets fully functional permission enforcement for
direct `perm`-claim principals (e.g. API-Key scopes), just without role-based permissions.
SDK-Auth registers `RoleManagerPermissionSource` (internal), backed by
`RoleManager<ApplicationRole>`, as its `IRolePermissionSource`.

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

`UserDetailDto` additionally exposes a `PreferredCulture` field:

```csharp
public sealed record UserDetailDto
{
    // ... Id, Email, UserName, DisplayName, IsLockedOut, EmailConfirmed, Roles ...

    /// Optional persisted language preference (BCP-47/ISO-639-1, e.g. "de" or "en-US").
    /// null when unset — consumers apply their own fallback.
    public string? PreferredCulture { get; init; }
}
```

`PreferredCulture` is `null` for accounts that never set a preference (including all
accounts that existed before this feature — the underlying `AspNetUsers.PreferredCulture`
column is a nullable, additive EF Core migration and does not require any data backfill).
The SDK does not enforce a default when it is `null`; the consuming application decides
its own fallback (e.g. the app's default culture or the request's ambient culture).

### IUserCulturePreferenceService

`IUserCulturePreferenceService` (from `Auth.Contracts`) reads and writes a user's
`PreferredCulture` directly, without requiring an HTTP context — suitable for background
jobs, webhooks, or admin tooling that needs to set the preference outside a request:

```csharp
namespace BieberWorks.SDK.Auth.Contracts;

public interface IUserCulturePreferenceService
{
    Task<string?> GetPreferredCultureAsync(string userId, CancellationToken ct = default);
    Task SetPreferredCultureAsync(string userId, string culture, CancellationToken ct = default);
}
```

The implementation (`UserCulturePreferenceService` in `Auth.Management`) is backed by
`UserManager<ApplicationUser>`; `SetPreferredCultureAsync` throws `InvalidOperationException`
if the user does not exist or the underlying `UserManager.UpdateAsync` fails.

### Automatic sync via IUserCultureSyncHook

Auth registers an implementation of Foundation's `IUserCultureSyncHook`
(`BieberWorks.SDK.SharedKernel.Localization`) so that when a logged-in user switches
culture through `/bw/set-culture`, the change is automatically persisted onto their
account — no extra wiring required in the host application:

```csharp
internal sealed partial class AuthUserCultureSyncHook(
    IServiceScopeFactory scopeFactory,
    ILogger<AuthUserCultureSyncHook> logger)
    : IUserCultureSyncHook
{
    public async Task OnCultureChangedAsync(string userId, string culture, CancellationToken ct = default)
    {
        // Resolves its own DI scope (fire-and-forget, runs outside the request scope)
        // and delegates to IUserCulturePreferenceService.SetPreferredCultureAsync.
    }
}
```

Because the culture-sync endpoint invokes the hook fire-and-forget outside the original
request scope, `AuthUserCultureSyncHook` creates its own scope via `IServiceScopeFactory`
rather than depending on scoped services directly, and catches/logs its own exceptions
(a warning is logged, the culture-switch redirect is never affected).

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
