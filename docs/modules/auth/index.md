# Auth

The Auth module provides complete authentication and authorization infrastructure for BieberWorks SDK hosts. It includes user registration, cookie and JWT-based login, password flows, email confirmation, two-factor authentication, a flexible role and permission system, and ready-made MudBlazor UI pages.

## What the module offers

- **Dual-Scheme Authentication** — Cookie-based auth for Blazor Server / SSR and JWT Bearer for API clients in a single host
- **ASP.NET Core Identity** with PostgreSQL backend (schema `auth`) and dedicated `AuthDbContext` including automatic migration
- **Permission System** — cross-module permissions assigned to roles; fine-grained protection via `[RequiresPermission]` or `.RequirePermission()`
- **Role Management** — CRUD for roles including permission assignment via `IRoleManagementService`
- **User Management** — Admin endpoints for locking/unlocking users, role assignment, and account deletion (`UserManagementModule`); self-service account deletion with password reauth and cross-module impact gate
- **Email Flows** — confirmation email and password reset via the email-template pipeline; optional integration with `SDK-Email`
- **Two-Factor Authentication** — email OTP second factor with single-use recovery codes (enable / disable / verify / regenerate)
- **Profile Self-Service** — users can change their username, display name, and resend their confirmation email
- **Self-Registration Control** — registration can be disabled via host config (hard lock) and/or a runtime admin toggle, gated by the `auth:registration:manage` permission
- **Rate Limiting** — login attempts are internally limited (`ILoginRateLimitService`)
- **Ready-made MudBlazor Pages** — login, registration, password forgotten, password reset, profile, security, avatar, and admin pages for user, role, and registration management

## Package overview

| Package | Description | When needed |
|---|---|---|
| `BieberWorks.SDK.Auth.Contracts` | Interfaces, DTOs, domain events, permission abstraction — no dependency on implementation | Always when another module consumes Auth services |
| `BieberWorks.SDK.Auth` | Complete implementation: Identity, EF Core, JWT/Cookie, Minimal API endpoints, CQRS handlers | In the host providing the Auth API |
| `BieberWorks.SDK.Auth.Management` | Separate `IModule` for admin REST endpoints under `/api/admin/users` and `/api/admin/roles` | When admin user/role management via REST is needed |
| `BieberWorks.SDK.Auth.UI` | Abstract Blazor base classes (framework-agnostic logic, `ComponentBase` derivations) | Transitively — referenced by `.UI.MudBlazor` |
| `BieberWorks.SDK.Auth.UI.MudBlazor` | Ready-made MudBlazor Razor components and pages | When using the built-in Auth pages in the host |
| `BieberWorks.SDK.Auth.Client` | `HttpAuthClient` — HTTP implementation of `IAuthClient` for WASM/MAUI-Hybrid | When an external client (not in-proc) calls the Auth API |

::: tip Versioning
All packages are released together and share one version, computed from Conventional Commits. The latest release and full history live on the [GitHub Releases page](https://github.com/BieberWorks/SDK-Auth/releases) (see [changelog](CHANGES.md)).
:::

## When to use which package

| Scenario | Required packages |
|---|---|
| Another module consumes `ICurrentUserProvider` or `IPermissionService` | `Auth.Contracts` |
| Module registers custom permissions in the catalog | `Auth.Contracts` (implements `IPermissionContributor`) |
| Host provides Auth API | `Auth` + optional `Auth.Management` |
| Host with ready-made Blazor interface | `Auth` + `Auth.UI.MudBlazor` |
| External WASM/MAUI app communicates via HTTP | `Auth.Client` |

## Documentation

| Topic | Document |
|---|---|
| Installation, `Program.cs`, `appsettings.json`, JWT/cookie config, AppBar widget, admin bootstrap, migrations | [Setup & Configuration](setup.md) |
| Dual-scheme login, token refresh, registration, email confirmation, password flows, **profile self-service**, two-factor auth, email senders/templates | [Authentication Flows](auth-flows.md) |
| Disabling self-registration: host config + runtime admin toggle, `auth:registration:manage` permission, single-user/portfolio recipe | [Registration](registration.md) |
| Role model, permission system, defining/checking permissions, role & user management, domain events | [Roles & Permissions](roles-permissions.md) |
| Self-service and admin-initiated account deletion, guard sequence, erasure preview, cross-module wiring | [Account Deletion](account-deletion.md) |
| Ready-made pages, components, `UserMenu` widget, `IAuthClient`, validation attributes, localization | [UI Components](ui-components.md) |
| Release history | [Changelog](CHANGES.md) |
