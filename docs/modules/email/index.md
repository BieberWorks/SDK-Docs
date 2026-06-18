# SDK-Email

The module **BieberWorks.SDK.Email** provides a MailKit-based SMTP send facility and a template system for transactional emails. Without configuration (`UseSmtp: false`), the module automatically falls back to a `LoggingEmailSender` that logs outgoing emails only — practical for local development.

## Packages

| NuGet package | Contents | Reference |
|---|---|---|
| `BieberWorks.SDK.Email.Contracts` | `IEmailSender`, `IEmailTemplateProvider`, `IEmailTemplateRenderer`, `EmailMessage`, `EmailAttachment`, `EmailSettings`, `EmbeddedEmailTemplateProvider`, `EmailTemplateProviderOrder` | other modules |
| `BieberWorks.SDK.Email` | `EmailModule`, `SmtpEmailSender`, `LoggingEmailSender`, `FileSystemEmailTemplateProvider`, `EmailTemplateRenderer` | host |

**Current version:** `v0.0.5`

## Interfaces at a glance

| Interface | Registration | Purpose |
|---|---|---|
| `IEmailSender` | Scoped | Send email (`SendAsync`) |
| `IEmailTemplateRenderer` | Singleton | Render template (`Render`) |
| `IEmailTemplateProvider` | Singleton, multiple possible | Provide template HTML (`TryGetTemplate`) |

## Template Provider priority

Multiple `IEmailTemplateProvider` can be registered. The one with the lowest `Order` value wins.

| Provider | Order | Activation |
|---|---|---|
| Custom (own implementation) | `0` | Manually registered |
| `FileSystemEmailTemplateProvider` | `100` | Automatic; active if `Email:TemplatePath` is set |
| `EmbeddedEmailTemplateProvider` | `1000` | Manually registered, e.g. by Auth module |

The `FileSystemEmailTemplateProvider` returns `null` (no error) if the path is not configured or the file does not exist — then the next provider is tried.

## Dependencies

The module depends on no other domain module (no Auth, no Audit). It only requires `BieberWorks.SDK.Core`.
