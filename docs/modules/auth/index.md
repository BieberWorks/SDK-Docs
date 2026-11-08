# Auth

The Auth module provides complete authentication and authorization infrastructure for BieberWorks SDK hosts. It includes user registration, cookie and JWT-based login, password flows, email confirmation, two-factor authentication, a flexible role and permission system, and ready-made MudBlazor UI pages.

## What the module offers

- **Dual-Scheme Authentication** — Cookie-based auth for Blazor Server / SSR and JWT Bearer for API clients in a single host
- **ASP.NET Core Identity** with PostgreSQL backend (schema `auth`) and dedicated `AuthDbContext` including automatic migration
- **Permission System** — cross-module permissions assigned to roles; fine-grained protection via `[RequiresPermission]` or `.RequirePermission()`
- **Server-Side Cookie Sessions** — every cookie sign-in is a row in `auth.UserSessions`: sign-out, lock, password and 2FA changes end sessions, roles are live, absolute and idle limits are enforced, open Blazor circuits are revalidated
- **Role Management** — CRUD for roles including permission assignment via `IRoleManagementService`
- **User Management** — Admin endpoints for locking/unlocking users, role assignment, and account deletion (`UserManagementModule`); self-service account deletion with password reauth and cross-module impact gate
- **Email Flows** — confirmation email and password reset via the email-template pipeline; optional integration with `SDK-Email`
- **Two-Factor Authentication** — email OTP second factor with single-use recovery codes (enable / disable / verify / regenerate)
- **Profile Self-Service** — users can change their username, display name, and resend their confirmation email
- **Self-Registration Control** — registration can be disabled via host config (hard lock) and/or a runtime admin toggle, gated by the `auth:registration:manage` permission
- **Rate Limiting** — login attempts and two-factor verify/resend are limited through `IRateLimiter` (SDK-RateLimiting)
- **Ready-made MudBlazor Pages** — login, registration, password forgotten, password reset, profile, security, avatar, and admin pages for user, role, and registration management

## Package overview

| Package | Description | When needed |
|---|---|---|
| `BieberWorks.SDK.Auth.Contracts` | Interfaces, DTOs, domain events, permission abstraction — no dependency on implementation | Always when another module consumes Auth services |
| `BieberWorks.SDK.Auth` | Complete implementation: Identity, EF Core, JWT/Cookie, Minimal API endpoints, CQRS handlers | In the host providing the Auth API |
| `BieberWorks.SDK.Auth.Session` | Session validation client: cached validator, cookie hook, remote validator for web hosts without database, circuit provider, activity listener. No EF Core, no Identity | Transitively with `Auth` / `Auth.UI.Blazor.MudBlazor`; directly in a decoupled web host |
| `BieberWorks.SDK.Auth.Management` | Separate `IModule` for admin REST endpoints under `/api/admin/users` and `/api/admin/roles` | When admin user/role management via REST is needed |
| `BieberWorks.SDK.Auth.UI.Blazor` | Abstract Blazor base classes (framework-agnostic logic, `ComponentBase` derivations) | Transitively — referenced by `.UI.Blazor.MudBlazor` |
| `BieberWorks.SDK.Auth.UI.Blazor.MudBlazor` | Ready-made MudBlazor Razor components and pages | When using the built-in Auth pages in the host |
| `BieberWorks.SDK.Auth.Client` | `HttpAuthClient` — HTTP implementation of `IAuthClient` for WASM/MAUI-Hybrid | When an external client (not in-proc) calls the Auth API |
| `BieberWorks.SDK.Auth.Client.Server` | Server-side credential sources (HttpContext, Blazor circuit) and `AddBieberWorksAuthForwarding()` for forwarding the user credential via `AuthForwardingHandler` (see [Auth forwarding](15-auth-forwarding.md)) | In a web host calling a protected backend API |
| `BieberWorks.SDK.Auth.Bff` | Backend-for-frontend for Blazor Server hosts: opaque session cookie, server-side token vault with refresh, antiforgery-protected login/logout, circuit token hook, replaceable session store (see [BFF](17-bff.md)) | In a Blazor Server frontend that signs in against a separate identity service |
| `BieberWorks.SDK.Auth.Bff.Postgres` | PostgreSQL session store and shared Data Protection key ring for `Auth.Bff` | When BFF sessions must survive restarts or be shared by several hosts |

::: tip Versioning
All packages are released together and share one version, computed from Conventional Commits. The latest release and full history live on the [GitHub Releases page](https://github.com/BieberWorks/SDK-Auth/releases) (see [changelog](90-changelog.md)).
:::

## When to use which package

| Scenario | Required packages |
|---|---|
| Another module consumes `ICurrentUserProvider` or `IPermissionService` | `Auth.Contracts` |
| Module registers custom permissions in the catalog | `Core.Authorization` (implements `IPermissionContributor`) |
| Host provides Auth API | `Auth` + optional `Auth.Management` |
| Host with ready-made Blazor interface | `Auth` + `Auth.UI.Blazor.MudBlazor` |
| External WASM/MAUI app communicates via HTTP | `Auth.Client` |

## Documentation

| Topic | Document |
|---|---|
| Installation, `Program.cs`, `appsettings.json`, JWT/cookie config, AppBar widget, admin bootstrap, migrations | [Setup & Configuration](01-getting-started.md) |
| Dual-scheme login, token refresh, registration, email confirmation, password flows, **profile self-service**, two-factor auth, email senders/templates | [Authentication Flows](10-auth-flows.md) |
| Disabling self-registration: host config + runtime admin toggle, `auth:registration:manage` permission, single-user/portfolio recipe | [Registration](11-registration.md) |
| Server-side cookie sessions: revocation, idle/absolute limits, caching, failure policy, decoupled web hosts, circuits, privacy | [Sessions](14-sessions.md) |
| Role model, permission system, defining/checking permissions, role & user management, **PreferredCulture / IUserCulturePreferenceService**, domain events | [Roles & Permissions](12-roles-permissions.md) |
| Self-service and admin-initiated account deletion, guard sequence, erasure preview, cross-module wiring | [Account Deletion](13-account-deletion.md) |
| Ready-made pages, components, `UserMenu` widget, `IAuthClient`, validation attributes, localization | [UI Components](50-ui-components.md) |
| Release history | [Changelog](90-changelog.md) |
