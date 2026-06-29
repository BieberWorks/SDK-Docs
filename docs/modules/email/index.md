# SDK-Email

The module **BieberWorks.SDK.Email** provides a MailKit-based SMTP send facility, a Scriban-powered template system with database overrides and layout support, an Admin UI for managing templates and layouts, and a dual-recipient submission notifier. Without SMTP configuration (`UseSmtp: false`) the module automatically falls back to a `LoggingEmailSender` — practical for local development.

## Packages

| NuGet package | Contents | When needed |
|---|---|---|
| `BieberWorks.SDK.Email.Contracts` | `IEmailSender`, `IEmailTemplateProvider`, `IEmailTemplateRenderer`, `IEmailRenderingPipeline`, `IEmailTemplateAdminService`, `IEmailTemplateDescriptor`, `ISubmissionNotifier`, `EmailMessage`, `EmailAttachment`, `EmailSettings`, `EmailRateLimitOptions`, `EmailRateLimitExceededException`, `DualNotification`, `IEmailGlobalVariableProvider`, `EmailTemplateProviderOrder`, `EmailPermissions` | Other modules that inject email services or register descriptors |
| `BieberWorks.SDK.Email` | `EmailModule`, `SmtpEmailSender`, `LoggingEmailSender`, `RateLimitedEmailSender`, `FileSystemEmailTemplateProvider`, `DatabaseEmailTemplateProvider`, `EmbeddedEmailTemplateProvider` (+ `AddEmbeddedEmailTemplates`), `EmailTemplateRenderer`, `EmailTemplateAdminService`, `CachedEmailTemplateStore`, `SubmissionNotifier` | Host application |
| `BieberWorks.SDK.Email.UI` | Framework-agnostic Blazor base classes: `EmailTemplatesPageBase`, `EmailTemplateEditorPageBase`, `EmailLayoutsPageBase`, `EmailLayoutEditorPageBase`; `IEmailTemplateEditorFactory` | Transitively — referenced by `.UI.MudBlazor` |
| `BieberWorks.SDK.Email.UI.MudBlazor` | `EmailUiModule` (auto-discovered), `EmailAdminSection`, `TextareaEmailTemplateEditorFactory`, live-preview POST endpoint `/admin/email/preview` | Host with the built-in Email Admin pages |

::: tip Versioning
All packages are released together and share one version, computed from Conventional Commits. The latest release and full history live on the [GitHub Releases page](https://github.com/BieberWorks/SDK-Email/releases) (see [Changelog](CHANGES.md)).
:::

## Interfaces at a glance

| Interface | Registration | Purpose |
|---|---|---|
| `IEmailSender` | Scoped | Send an email (`SendAsync`) |
| `IEmailTemplateRenderer` | Scoped | Render a template by key with variable substitution; `RenderAsync` also injects branding |
| `IEmailRenderingPipeline` | Singleton | Core pipeline: resolves DB override → layout → Scriban; returns `RenderedEmail` (HTML + plain text) |
| `IEmailTemplateProvider` | Singleton, multiple | Supply raw template HTML (`TryGetTemplateAsync`) |
| `IEmailTemplateAdminService` | Scoped | Admin CRUD: list/get/save/reset template overrides, manage layouts, render preview |
| `IEmailTemplateDescriptor` | Singleton, multiple | Describe a transactional email (key, display name, variables, default HTML) for Admin UI discovery |
| `ISubmissionNotifier` | Scoped | Render + send customer and admin emails in one call; faults are caught and logged |

## Template Provider priority

Multiple `IEmailTemplateProvider` registrations are tried (via `TryGetTemplateAsync`) in ascending `Order` value. The first non-null result wins.

| Provider | Order | Activation |
|---|---|---|
| Custom (own implementation) | `0` | Manually registered |
| `FileSystemEmailTemplateProvider` | `100` | Active when `Email:TemplatePath` is set |
| `EmbeddedEmailTemplateProvider` | `1000` | Manually registered, e.g. by the Auth module |
| `DatabaseEmailTemplateProvider` | `2000` | Registered automatically by `EmailModule`; serves DB overrides created via Admin UI |

The `FileSystemEmailTemplateProvider` returns `null` (no error) when the path is not configured or the file does not exist — the next provider is then tried.

## Permissions

| Permission key | Constant | Description |
|---|---|---|
| `email:templates:view` | `EmailPermissions.ViewTemplates` | View the templates list and template details |
| `email:templates:edit` | `EmailPermissions.EditTemplates` | Create and update template overrides; use the live-preview endpoint |
| `email:layouts:manage` | `EmailPermissions.ManageLayouts` | Create, update and delete layouts |

## Dependencies

The module depends on no other domain module (no Auth, no Audit). It requires `BieberWorks.SDK.Core` and, for the Admin UI, `BieberWorks.SDK.Admin.Contracts`. The optional branding integration requires `BieberWorks.SDK.Theme.Contracts`.

## Documentation

| Topic | Document |
|---|---|
| Installation, `Program.cs`, `appsettings.json`, SMTP, rate limiting, UI packages setup | [Setup & Configuration](setup.md) |
| `IEmailSender`, `IEmailTemplateRenderer`, `IEmailTemplateProvider`, `ISubmissionNotifier` | [Usage](usage.md) |
| DB-backed template overrides, layouts, `IEmailTemplateDescriptor`, Admin UI, live preview, Scriban | [Template Management](template-management.md) |
| Auto-injected branding variables (`LogoUrl`, `BrandColor`, …), caching, cache invalidation | [Branding Integration](branding-integration.md) |
| Release history | [Changelog](CHANGES.md) |
