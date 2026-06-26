# SDK-Maintenance — Architecture

## Decision: Settings vs. DbContext

**Decision: Settings-backed storage via `ISettingsService`.**

The maintenance state is a small, infrequently written, frequently read value set that doesn't require historical tracking or complex queries:

- **No domain query surface.** The module reads one current state. `ISettingsService` is purpose-built for exactly this shape (get/set key-value pairs with caching).
- **Zero migration overhead.** A DbContext requires an EF migration, schema, and a registered `IModule` that calls `ApplyMigrationsAsync`. Not justified for this narrow feature.
- **Automatic caching.** `CachedSettingsStore` provides a sliding/absolute cache (default 5 min / 30 min). The middleware hot path — checked on every incoming HTTP request — needs sub-millisecond reads. Settings provides this for free via in-process memory cache.
- **Automatic auditing.** Settings raises `SettingChangedEvent : IAuditableEvent` on every write. Maintenance-mode toggles and content edits are automatically logged to SDK-Audit with zero direct Audit dependency in this module.
- **Reduced consumer setup.** SDK-Admin already mandates Settings at the host level. No additional infrastructure or dependency burden.

**Trade-offs:**
- Hard dependency on `BieberWorks.SDK.Settings.Contracts`. Acceptable because any host running SDK-Admin already has Settings installed.
- No history of maintenance windows. If full historical tracking is needed later (all past windows with start/end timestamps), a `MaintenanceDbContext` can be added as a non-breaking addition in v0.1.x or v1.x.

---

## Middleware Request Processing

The middleware intercepts every incoming HTTP request and applies a four-stage decision tree:

### Stage 1: Bypass Predicate

```
BypassPredicate(context) == true?
  YES → Allow request (call next middleware)
  NO  → Continue to Stage 2
```

The predicate runs **before any Settings read**, so authenticated admins never incur a cache lookup. Default behavior:

```csharp
ctx.User.Identity?.IsAuthenticated == true &&
(ctx.User.IsInRole("Admin") ||
 ctx.User.HasClaim("role", "Admin") ||
 ctx.User.HasClaim(ClaimTypes.Role, "Admin"))
```

Rationale: Admins must always access the application, even during maintenance, to diagnose and resolve issues. The check is fast (claim inspection only, no DB/cache reads).

### Stage 2: Always-Allowed Paths

```
path.StartsWith(AlwaysAllowedPaths[*], IgnoreCase)?
  YES → Allow request (call next middleware)
  NO  → Continue to Stage 3
```

Simple case-insensitive prefix matching (no regex). Examples:
- `/bw/auth/` allows `/bw/auth/login`, `/bw/auth/register`, `/bw/auth/callback`
- `/_blazor` allows `/_blazor/negotiate`, `/_blazor?id=...` (Blazor SignalR connection)
- `/_framework` allows static JS/WASM framework files

Default list: `["/_blazor", "/_framework", "/favicon.ico"]`

**Merged at runtime with all registered `IMaintenancePathProvider` instances.** This allows modules to contribute paths without touching host config.

### Stage 3: Enable Status Check

```
IsEnabledAsync() == false?
  YES → Allow request (maintenance not active)
  NO  → Continue to Stage 4
```

Reads from the Settings cache (sub-millisecond in the default path). If maintenance mode is disabled, the request proceeds normally.

### Stage 4: Response Handling

Maintenance is active and the request was not bypassed or whitelisted. Decide based on request type:

```
Accept: application/json OR path.StartsWith("/api/")?
  YES → HTTP 503 { status, title, message, reason, eta }
  NO  → HTTP 302 Redirect to options.PagePath
```

**API responses** (503 JSON):
- Detected by `Accept: application/json` header or `/api/` path prefix.
- Allows API clients to detect maintenance and respond gracefully.

**Browser responses** (redirect):
- Redirects to `options.PagePath` (default `/maintenance`).
- The consumer must implement the `/maintenance` Razor page.
- If not implemented, the browser sees a 404 (intentional — forces consumer to own the UX).

---

## Setting Keys

Maintenance state is stored in `ISettingsService` under the `Maintenance:*` namespace:

| Key | Type | Default | Notes |
|---|---|---|---|
| `Maintenance:IsEnabled` | boolean string ("true" or "false") | "false" | Toggles maintenance mode on/off |
| `Maintenance:Title` | string | "Maintenance" | Shown on the maintenance page |
| `Maintenance:Message` | string | "We'll be right back." | Shown on the maintenance page |
| `Maintenance:Reason` | string (nullable) | "" | Optional explanation (e.g., "Database upgrade") |
| `Maintenance:Eta` | string (nullable) | "" | Optional ETA (e.g., "approx. 2 hours") |
| `Maintenance:EnabledAt` | string (ISO 8601, UTC) | "" | UTC timestamp when maintenance was last enabled |

These keys are **internal** — consumers interact with `IMaintenanceModeService` (read) or `ISettingsAdminService` (write via Admin UI).

---

## Package Dependency Diagram

```
BieberWorks.SDK.Maintenance.Contracts
  ├── BieberWorks.SDK.SharedKernel
  └── BieberWorks.SDK.Settings.Contracts

BieberWorks.SDK.Maintenance
  ├── BieberWorks.SDK.Maintenance.Contracts
  ├── BieberWorks.SDK.Core               (IModule, IModuleInitializer)
  ├── BieberWorks.SDK.Settings.Contracts (ISettingsService for reads)
  └── [Microsoft.AspNetCore.*]           (middleware, HttpContext — implicit via Sdk.Web)

BieberWorks.SDK.Maintenance.UI.MudBlazor
  ├── BieberWorks.SDK.Maintenance.Contracts
  ├── BieberWorks.SDK.Core               (IModule)
  ├── BieberWorks.SDK.Admin.Contracts    (IAdminSection, AdminNavItem)
  ├── BieberWorks.SDK.Settings.Contracts (ISettingsAdminService for writes)
  ├── BieberWorks.SDK.Theme.Contracts    (IBrandingService for logo/branding in preview)
  └── MudBlazor 9.*
```

**No circular or cross-UI dependencies:**
- Contracts package is MudBlazor-free and lightweight.
- Core package has no Admin dependency (pure middleware/service).
- UI package only references Admin.Contracts and Settings.Contracts (not UI packages).
- `IAdminSection.Key = "maintenance"` is set (mandatory since Admin 1.0.0).
- Double-registration guarded via `TryAddEnumerable` in `MaintenanceUiModule`.

---

## Extension Points

### IMaintenancePathProvider

Allows packages and modules to contribute whitelisted paths without coupling to host configuration:

```csharp
public interface IMaintenancePathProvider
{
    /// <summary>
    /// Returns path prefixes (matched with case-insensitive StartsWith)
    /// that should always bypass maintenance checks.
    /// </summary>
    IEnumerable<string> GetAllowedPaths();
}
```

**Usage pattern:**
- Register in a module's `AddXxx` method: `services.TryAddEnumerable(ServiceDescriptor.Singleton<IMaintenancePathProvider, MyProvider>())`
- The middleware collects all registered providers at request time.
- Paths are merged with `AlwaysAllowedPaths` — fully additive, no conflicts.

Example:

```csharp
// In SDK-Auth module (hypothetical)
internal class AuthPathProvider : IMaintenancePathProvider
{
    public IEnumerable<string> GetAllowedPaths() =>
    [
        "/bw/auth/",
        "/bw/account/login",
        "/bw/account/register"
    ];
}

// Auto-registered by AuthModule:
public static IServiceCollection AddBieberWorksAuth(this IServiceCollection services)
{
    // ...
    services.TryAddEnumerable(
        ServiceDescriptor.Singleton<IMaintenancePathProvider, AuthPathProvider>());
    return services;
}
```

The host doesn't know or care about Auth's paths — they are auto-contributed at registration time.

### IMaintenanceModeService

Read-only service for consuming the current maintenance state:

```csharp
public interface IMaintenanceModeService
{
    /// <summary>Returns true if maintenance mode is active.</summary>
    ValueTask<bool> IsEnabledAsync(CancellationToken ct = default);

    /// <summary>Returns the full status (title, message, reason, ETA, enabled timestamp).</summary>
    ValueTask<MaintenanceStatus> GetStatusAsync(CancellationToken ct = default);
}
```

**Use cases:**
- Consumer maintenance page reads the status and renders custom UI.
- External dashboards/status pages query the service to show app status.
- Health-check endpoints can include maintenance state in their output.

---

## Performance Characteristics

| Operation | Latency | Frequency | Notes |
|---|---|---|---|
| Bypass predicate check | < 1 µs | Every request | Claim inspection only, no I/O |
| Path prefix match (AlwaysAllowedPaths) | < 10 µs | Most requests | Linear scan of ~3 paths (default) |
| Settings cache read (IsEnabledAsync) | < 100 µs (cached) | Every non-bypassed request | Default cache TTL 5 min / 30 min absolute |
| JSON serialization (503 response) | < 5 ms | API calls only | Small payload (~200 bytes) |
| Redirect response (302) | < 1 ms | Browser requests | Just sets Location header |

The hot path (bypassed admin request): **~1 µs**, making it safe to call on every request without measurable overhead.
