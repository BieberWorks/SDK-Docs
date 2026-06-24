# Changelog

## Unreleased (v0.3.0)

- docs: GDPR data-subject rights (Phase 3) — `gdpr-data-subject-rights.md` added
- docs: `events-auditing.md` extended with three GDPR audit events
- docs: `overview.md` updated with Phase 2 and Phase 3 feature matrices

## Unreleased (v0.2.0)

- Phase 2: Cookie-Consent activation
- `LegalOptions.CookieRegistrations` — configurable cookie registrations, registered via `RegisterCookies` at module startup
- `LegalDocumentKeys.Cookies` constant — document key for mirroring cookie choices into `UserConsent`
- `/legal/cookies` (alias `/cookies`) — Cookie Settings page with per-category toggles and reopen-banner button
- `CookieConsentMirror` — headless component; subscribes to `ICookieConsentService.OnConsentChanged` and mirrors the choice for authenticated users into `UserConsent`
- Double-mirror prevention: `CookieConsentMirror` covers the banner path; `/legal/cookies` page covers the manual settings path; both write append-only rows — no deduplication needed at service level
- `BieberWorks.SDK.UI.Contracts` reference added to all three packages

## v0.1.0

- Initial release: versioned legal documents + consent tracking (Phase 1)
- `ILegalDocumentService`, `IUserConsentService`
- EF Core schema `legal` (PostgreSQL), `InitialCreate` migration
- `LegalModule` with auto-migration + seeding
- MudBlazor public page, re-consent flow, admin list + editor
- `LegalAdminSection` (`Key = "legal"`)
- Domain events: `LegalDocumentUpdatedEvent`, `UserConsentRecordedEvent`, `UserConsentRevokedEvent`
- Permission: `legal:admin`
- Defect-A fix: consistent `CultureInfo.CurrentUICulture.Name` culture source

- Initial release: versioned legal documents + consent tracking (Phase 1)
- `ILegalDocumentService`, `IUserConsentService`
- EF Core schema `legal` (PostgreSQL), `InitialCreate` migration
- `LegalModule` with auto-migration + seeding
- MudBlazor public page, re-consent flow, admin list + editor
- `LegalAdminSection` (`Key = "legal"`)
- Domain events: `LegalDocumentUpdatedEvent`, `UserConsentRecordedEvent`, `UserConsentRevokedEvent`
- Permission: `legal:admin`
- Defect-A fix: consistent `CultureInfo.CurrentUICulture.Name` culture source
