# Changelog

## next (unreleased)

### Added
- `BieberWorks.SDK.Email.UI` — framework-agnostic page base classes: `EmailTemplatesPageBase`, `EmailTemplateEditorPageBase`, `EmailLayoutsPageBase`, `EmailLayoutEditorPageBase`.
- `IEmailTemplateEditorFactory` + `EmailTemplateEditorContext` in `Email.UI` — swappable editor seam for future Monaco integration.
- `BieberWorks.SDK.Email.UI.MudBlazor` — MudBlazor Admin UI: Templates list (grouped by Group, "customized" badge), Template editor (locale selector, layout dropdown, variable token validation, live preview via POST endpoint), Layouts CRUD with `{{ content }}` slot validation.
- `EmailAdminSection` (`IAdminSection`, Order=60) — wires Email into the SDK-Admin shell with Templates and Layouts nav items.
- `TextareaEmailTemplateEditorFactory` — default editor: MudBlazor-styled monospace `<textarea>`, zero JS dependencies.
- `EmailUiModule` (`IModule` + `IEndpointModule`) — auto-discovered; registers admin section, editor factory, and the `/admin/email/preview` POST endpoint.
- `AddEmailUi()` extension method for host `Program.cs` explicit registration.
- `DualNotification` record — untyped (string variable dictionary) descriptor for dual-recipient submission notifications (customer + optional admin).
- `DualNotification<TModel>` record — **preferred** strongly-typed variant; model properties are reflected into template placeholders automatically.
- `ISubmissionNotifier` interface with two overloads (`NotifyAsync(DualNotification)` and `NotifyAsync<TModel>(DualNotification<TModel>)`).
- `SubmissionNotifier` — default implementation in `BieberWorks.SDK.Email`. Renders both templates via `IEmailTemplateRenderer`, sends via `IEmailSender`. Admin email is skipped when `AdminEmail` is `null`. Send failures are caught and logged (no rethrow); customer and admin sends are independently fault-isolated.
- All logging via `[LoggerMessage]` source-generated delegates keyed on `LogContext`.
- Registered automatically by `EmailModule` (`AddScoped<ISubmissionNotifier, SubmissionNotifier>()`).


## v0.9.0 (2026-06-21)

### Added
- `EmailRateLimitOptions` — opt-in rate-limit configuration (`Email:RateLimit` section).
- `EmailRateLimitExceededException` — thrown when a limit is exceeded; carries `EmailRateLimitKind` discriminator (`GlobalPerMinute`, `GlobalPerHour`, `PerRecipientPerHour`).
- `RateLimitedEmailSender` — decorator for `IEmailSender`, active only when at least one limit is non-zero. Uses `IMemoryCache` for counters. All throttling events are logged via `[LoggerMessage]` delegates without PII.
- `EmailModule` automatically wraps the registered sender in the decorator when rate-limit options are present; no consumer-side wiring required.

## v0.0.5 (2026-06-18)

### Added
- English documentation added to module repository
