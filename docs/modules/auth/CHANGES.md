# Changelog

## v0.25.0 (2026-06-24)

### Added
- `AuthCookieRegistrationSource` — internal `ICookieRegistrationSource` implementation that provides the `bw.auth` session cookie registration. Description is resolved from `AuthResources` resx (en + de key `Auth.Cookies.bw.auth.Description`).
- `Auth.Cookies.bw.auth.Description` resx key added to `AuthResources.resx` and `AuthResources.de.resx`.

### Changed
- `AddAuthUi` no longer calls the deprecated `RegisterCookies(...)`. Cookie registration now uses `services.TryAddEnumerable(ServiceDescriptor.Singleton<ICookieRegistrationSource, AuthCookieRegistrationSource>())` which is idempotent and honours the module idempotency guard.

## Unreleased

### Added
- **Account deletion documentation**: new `docs/account-deletion.md` covering self-service deletion (`/account/delete`, password reauth, forced logout), admin-initiated deletion (`DELETE /api/admin/users/{userId}`, `UsersManage` permission), the `DeleteUserCommandHandler` guard sequence (NotFound → last-admin → reauth → impact gate → delete + event), `IAccountDeletionPreviewService` / `AccountDeletionPreviewResult`, and cross-module wiring with SDK-Legal via `UserAccountDeletionRequestedEvent`.
- **Email template registration**: Auth's transactional e-mails are now registered as `IEmailTemplateDescriptor`s (`AuthEmailTemplateKeys.PasswordReset` = `auth:password-reset`, `AuthEmailTemplateKeys.EmailConfirmation` = `auth:email-confirmation`). When `SDK-Email` is present they appear in the Email admin template list and become overridable per locale, with layout + branding applied. Registration is defensive (no-op without an Email module); Auth still couples only to `BieberWorks.SDK.Email.Contracts`. See [Email flows](auth-flows.md#email-templates-in-the-email-admin-ui).
- **Admin bootstrap**: `AuthBootstrapOptions` (`Auth:Bootstrap` config section) — opt-in, idempotent seed of the first Admin user on startup. `SeedAdmin=false` by default. Password must be supplied via user-secrets or environment variable, never in `appsettings.json`. See [Setup & Configuration](setup.md#admin-bootstrap-first-run-seed).

### Changed
- `AuthEmailSenderAdapter` now renders e-mail bodies **by descriptor key** via `IEmailTemplateRenderer.RenderAsync` (routing through `SDK-Email`'s override/layout/branding pipeline) instead of rendering the embedded template by file name. Sending behavior is otherwise unchanged.

## v0.13.0 (2026-06-18)

### Added
- English documentation added to module repository
