# Registering a Shell

## `AddBwShell<TMarker>`

```csharp
public static IServiceCollection AddBwShell<TMarker>(
    this IServiceCollection services,
    ShellDefinition definition,
    Func<IServiceProvider, string, bool>? permissionChecker = null)
    where TMarker : IShellSection
```

Call once per shell, typically from the shell's own module registration method:

```csharp
using BieberWorks.SDK.Shell.Contracts;
using BieberWorks.SDK.Shell.Extensions;

services.AddBwShell<IAdminSection>(
    new ShellDefinition("admin", "/admin", "Admin"),
    permissionChecker: (sp, permission) =>
    {
        var authz = sp.GetRequiredService<IAuthorizationService>();
        // evaluate `permission` against the current user...
        return true;
    });
```

### Parameters

- **`definition`** — The shell's `ShellDefinition` (key, route prefix, display name, optional
  shell-wide permission).
- **`permissionChecker`** — Optional callback `(IServiceProvider, string permission) => bool`,
  used to enforce `IShellSection.RequiredPermission` uniformly across all sections of this
  shell. When `null`, permission checks are skipped and all sections are visible regardless of
  `RequiredPermission`.

### What gets registered

1. **`IShellRegistry`** (singleton, shared across all `AddBwShell<TMarker>` calls in the host).
   `AddBwShell` adds this shell's `ShellDefinition` to the shared instance eagerly at
   registration time — no provider build required. Consumed by cross-shell UI, notably the
   multi-shell nav editor's shell discovery.
2. **`IShellNavOverrideStore`** (singleton, `TryAddSingleton`) — the settings-backed persistence
   implementation, shared by all shells (each keyed by `shellKey`).
3. **`IShellNavigationService<TMarker>`** (scoped, `TryAddScoped`) — resolves
   `IEnumerable<TMarker>` from DI, scoping section discovery to this shell only.
4. **`INavOverrideTarget`** (scoped, `AddScoped`) — the same instance as
   `IShellNavigationService<TMarker>` (it implements both interfaces), exposed as
   `INavOverrideTarget` so the multi-shell nav editor can discover it via
   `IEnumerable<INavOverrideTarget>` without depending on `TMarker`.

### Registration order

Register your `IEnumerable<TMarker>` section implementations (e.g.
`services.AddSingleton<IAdminSection, MyAdminSection>()`) **before** or after `AddBwShell` — the
service collection call order does not matter, since `IShellNavigationService<TMarker>` resolves
`IEnumerable<TMarker>` lazily via a factory the first time it's requested from a scope, not
during `AddBwShell` itself. What does matter is that all section registrations happen before the
first scope is created that resolves `IShellNavigationService<TMarker>` — i.e. before the app
starts serving requests.

### Multiple shells in one host

Each shell is registered independently with its own `TMarker`:

```csharp
services.AddBwShell<IAdminSection>(new ShellDefinition("admin", "/admin", "Admin"), permChecker);
services.AddBwShell<IAccountSection>(new ShellDefinition("account", "/account", "Account"), permChecker);
```

Both share the same `IShellRegistry` and `IShellNavOverrideStore`, but `IShellNavigationService<IAdminSection>`
and `IShellNavigationService<IAccountSection>` are independent — sections registered against one
marker are never visible to the other.
