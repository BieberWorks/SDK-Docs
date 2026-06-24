# SDK-Legal — Overview

BieberWorks.SDK.Legal provides versioned legal documents with consent tracking.

## Packages

| Package | Purpose |
|---|---|
| `BieberWorks.SDK.Legal.Contracts` | Interfaces, DTOs, domain events, options |
| `BieberWorks.SDK.Legal` | EF Core (schema `legal`), services, migrations |
| `BieberWorks.SDK.Legal.UI.MudBlazor` | MudBlazor public and admin pages |

## Feature Matrix — Phase 1

- Versioned legal documents per key + culture (DB-stored Markdown)
- `ILegalDocumentService`: read, list, update (version++ for versioned keys)
- `IUserConsentService`: record consent, revoke (append-only), history
- Re-consent flow UI (`ConsentAcceptance.razor`)
- Admin list + Markdown editor
- Auto-auditing via `IAuditableEvent` on all writes
- Permission `legal:admin`

## Feature Matrix — Phase 2

- Cookie-consent activation (`LegalOptions.CookieRegistrations`)
- `/legal/cookies` page with per-category toggles
- `CookieConsentMirror` headless component (mirrors cookie choices into `UserConsent`)

See [cookie-consent.md](cookie-consent.md) for details.

## Feature Matrix — Phase 3 (GDPR Data-Subject Rights)

- `IUserDataPrivacyOrchestrator` — aggregates all module `IUserDataExporter` / `IUserDataEraser`
- Best-effort erasure saga with per-module result persistence and idempotency
- `ErasureMode`: `HardDelete` | `Anonymize`
- `ErasureStatus`: `Pending` | `Completed` | `PartiallyFailed`
- `LegalUserDataExporter` — exports consent history as JSON
- `LegalUserDataEraser` — hard-deletes or anonymises consent records
- `LegalErasureImpactProvider` — pre-erasure warning for consent count
- `AccountDeletionErasureHandler` — event-driven trigger via `UserAccountDeletionRequestedEvent`
- Admin UI `/admin/legal/gdpr` — data export (JSON download) + erasure (mode select, status lookup)
- 3 audit events: `legal:gdpr:export-requested`, `legal:gdpr:erasure-requested`, `legal:gdpr:erased`

See [gdpr-data-subject-rights.md](gdpr-data-subject-rights.md) for the full reference.
