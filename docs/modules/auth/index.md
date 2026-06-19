# Auth

The Auth module provides complete authentication and authorization infrastructure for BieberWorks SDK hosts. It includes user registration, cookie and JWT-based login, password flows, email confirmation, two-factor authentication, a flexible role and permission system, and ready-made MudBlazor UI pages.

## What the module offers

- **Dual-Scheme Authentication** — Cookie-based auth for Blazor Server / SSR and JWT Bearer for API clients in a single host
- **ASP.NET Core Identity** with PostgreSQL backend (schema `auth`) and dedicated `AuthDbContext` including automatic migration
- **Permission System** — cross-module permissions assigned to roles; fine-grained protection via `[RequiresPermission]` or `.RequirePermission()`
- **Role Management** — CRUD for roles including permission assignment via `IRoleManagementService`
- **User Management** — Admin endpoints for locking/unlocking users and role assignment (`UserManagementModule`)
- **Email Flows** — confirmation email and password reset via `IAuthEmailSender`; optional integration with `SDK-Email`
- **Two-Factor Authentication** — enable / disable / code verification
- **Rate Limiting** — login attempts are internally limited (`ILoginRateLimitService`)
- **Ready-made MudBlazor Pages** — login, registration, password forgotten, password reset, profile, security, avatar, and admin pages for user and role management

## Package overview

| Package | Description | When needed |
|---|---|---|
| `BieberWorks.SDK.Auth.Contracts` | Interfaces, DTOs, domain events, permission abstraction — no dependency on implementation | Always when another module consumes Auth services |
| `BieberWorks.SDK.Auth` | Complete implementation: Identity, EF Core, JWT/Cookie, Minimal API endpoints, CQRS handlers | In the host providing the Auth API |
| `BieberWorks.SDK.Auth.Management` | Separate `IModule` for admin REST endpoints under `/api/admin/users` | When admin user management is needed |
| `BieberWorks.SDK.Auth.UI` | Abstract Blazor base classes (framework-agnostic logic, `ComponentBase` derivations) | Transitively — referenced by `.UI.MudBlazor` |
| `BieberWorks.SDK.Auth.UI.MudBlazor` | Ready-made MudBlazor Razor components and pages | When using the built-in Auth pages in the host |
| `BieberWorks.SDK.Auth.Client` | `HttpAuthClient` — HTTP implementation of `IAuthClient` for WASM/MAUI-Hybrid | When an external client (not in-proc) calls the Auth API |

::: tip Current version
All packages are released together. Current stable version: **v0.16.0**.
:::

## When to use which package

| Scenario | Required packages |
|---|---|
| Another module consumes `ICurrentUserProvider` or `IPermissionService` | `Auth.Contracts` |
| Module registers custom permissions in the catalog | `Auth.Contracts` (implements `IPermissionContributor`) |
| Host provides Auth API | `Auth` + optional `Auth.Management` |
| Host with ready-made Blazor interface | `Auth` + `Auth.UI.MudBlazor` |
| External WASM/MAUI app communicates via HTTP | `Auth.Client` |
