# SDK-Legal

SDK-Legal provides versioned legal documents with consent tracking, cookie-consent activation, and a complete GDPR data-subject rights implementation for BieberWorks SDK hosts.

## What the module offers

- **Versioned legal documents** — DB-stored Markdown content per key and culture; every update increments the version counter for versioned documents
- **Consent tracking** — append-only `UserConsent` table; full history, revocation support
- **Re-consent enforcement** — `IConsentEnforcementService` + `LegalConsentGuard` Blazor component cover both the initial HTTP request and all subsequent in-circuit navigations
- **Cookie-consent activation** — `LegalOptions.CookieRegistrations` wires consumer-specific cookies into the SDK-UI banner; `CookieConsentMirror` mirrors authenticated-user choices server-side
- **GDPR data-subject rights** — `IUserDataPrivacyOrchestrator` drives a best-effort erasure saga across all registered `IUserDataEraser` / `IUserDataExporter` implementations; admin UI at `/admin/legal/gdpr`
- **Account-deletion integration** — event-driven trigger via `UserAccountDeletionRequestedEvent` (SharedKernel); no compile-time dependency on SDK-Auth
- **Auto-auditing** — all write events implement `IAuditableEvent`; SDK-Audit picks them up with no extra configuration
- **Permission** `legal:admin` — registered automatically via `LegalPermissionContributor`

## Package overview

| Package | Description | When needed |
|---|---|---|
| `BieberWorks.SDK.Legal.Contracts` | Interfaces, DTOs, domain events, `LegalOptions`, `LegalDocumentKeys`, `LegalPermissions` — no EF Core | Always when another module or host references Legal services |
| `BieberWorks.SDK.Legal` | EF Core implementation (schema `legal`), services, migrations, GDPR orchestrator | In the host that provides the Legal data layer |
| `BieberWorks.SDK.Legal.UI.MudBlazor` | MudBlazor public pages, admin pages, `LegalConsentGuard`, `CookieConsentMirror` | When using the built-in Legal pages in the host |

## When to use which package

| Scenario | Required packages |
|---|---|
| Another module consumes `IUserConsentService` or `ILegalDocumentService` | `Legal.Contracts` |
| Host provides the full legal data store + GDPR orchestration | `Legal` |
| Host with ready-made Blazor legal pages, cookie banner wiring, and admin UI | `Legal` + `Legal.UI.MudBlazor` |
| Module registers its own `IUserDataEraser` / `IUserDataExporter` | SharedKernel only (no Legal dependency) |

## Documentation

| Topic | Document |
|---|---|
| Service registration, router setup, migrations, connection string | [Getting Started](getting-started.md) |
| `LegalDocument` and `UserConsent` entity model, schema, append-only design | [Content Model](content-model.md) |
| `IConsentEnforcementService`, `LegalConsentGuard`, exempt paths, HTTP middleware | [Consent Enforcement](consent-enforcement.md) |
| Cookie registrations, `CookieConsentMirror`, `/legal/cookies` settings page | [Cookie Consent](cookie-consent.md) |
| `IUserDataPrivacyOrchestrator`, erasure saga, `AccountDeletionErasureHandler`, admin UI `/admin/legal/gdpr`, implementing erasers in other modules | [GDPR Data-Subject Rights](gdpr-data-subject-rights.md) |
| `LegalPermissions.Admin`, `LegalPermissionContributor` | [Permissions](permissions.md) |
| Public and admin routes, literal speaking routes, culture resolution | [Routing](routing.md) |
| Resource files, `IStringLocalizer<LegalResources>`, document content cultures | [Localization](localization.md) |
| All domain events, `IAuditableEvent`, audit actions, publication order | [Domain Events & Auditing](events-auditing.md) |
| Release history | [Changelog](CHANGES.md) |
