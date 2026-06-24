# Changelog

## v1.0.0 (2026-06-24) — Breaking

### Breaking Changes
- `AddLegalModule` no longer calls `LegalModule.RegisterServices` internally. It is now a pure options setter. `LegalModule` must be registered via `AddBieberWorksModules` (auto-discovery). Consumers that called `AddLegalModule` as the sole registration path will no longer have `LegalModule` services in DI — add `AddBieberWorksModules` to fix.
- `LegalOptions.CookieRegistrations` default is now `[]`. The `bw.consent` cookie is always contributed by `LegalCookieRegistrationSource` programmatically. The `bw.analytics` placeholder has been removed.

### Added
- `LegalCookieRegistrationSource` — internal `ICookieRegistrationSource` implementation. Always emits `bw.consent` (Necessary, description from resx) and appends consumer-configured entries from `LegalOptions.CookieRegistrations`.
- `Legal.Cookies.bw.consent.Description` resx key in `LegalImplResources` (en + de) and `LegalResources` (neutral + en + de).

### Changed
- `LegalModule.RegisterServices` no longer calls `RegisterCookies`. Cookies are now resolved lazily at runtime via `IEnumerable<ICookieRegistrationSource>` in `CookieConsentService`.
- `LegalOptions.CookieRegistrations` is now an extension point for consumer-specific non-necessary cookies only (no SDK defaults).

### Migration Guide
In your host `Program.cs`, ensure `AddBieberWorksModules` is called before `AddLegalModule`:
```csharp
builder.Services.AddBieberWorksModules(builder.Configuration); // registers LegalModule
builder.Services.AddLegalModule(builder.Configuration, o =>    // sets options only
{
    o.Cultures = ["de", "en"];
    o.Documents = [...];
    // Add your own non-necessary cookies here if needed:
    // o.CookieRegistrations = [new("sn.analytics", CookieCategory.Analytics, "...", "YourApp")];
});
```

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
