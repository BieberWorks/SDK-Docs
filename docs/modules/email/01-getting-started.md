# Setup

## NuGet packages

```xml
<!-- Host .csproj — core email functionality -->
<PackageReference Include="BieberWorks.SDK.Email" Version="0.*-*" />

<!-- Admin UI with template management (requires SDK-Admin) -->
<PackageReference Include="BieberWorks.SDK.Email.UI.Blazor.MudBlazor" Version="0.*-*" />
```

::: tip Contracts for other modules
Modules that inject `IEmailSender`, register `IEmailTemplateDescriptor`, or reference `EmailPermissions`:
```xml
<PackageReference Include="BieberWorks.SDK.Email.Contracts" Version="0.*-*" />
```
:::

## Program.cs

`EmailModule` implements `IModule` and is automatically discovered by `AddBieberWorksModules`. No explicit call is required for the core functionality.

`EmailUiModule` (in `Email.UI.Blazor.MudBlazor`) is also auto-discovered and registers the Admin UI section and the live-preview endpoint.

```csharp
// Loads all modules — EmailModule and EmailUiModule are automatically included.
builder.Services.AddBieberWorksModules(builder.Configuration);

// ...

// Required for the preview POST endpoint (/admin/email/preview).
app.MapBieberWorksEndpoints();
```

The module reads `Email:UseSmtp` from configuration on startup:
- `UseSmtp: true` → `SmtpEmailSender` is registered as `IEmailSender`
- `UseSmtp: false` (default) → `LoggingEmailSender` is registered (no actual send)

`EmailModule` also implements `IModuleInitializer` and applies EF Core migrations for the `email` schema automatically on startup.

## SMTP configuration in appsettings.json

```json
{
  "Email": {
    "UseSmtp": true,
    "Host": "smtp.example.com",
    "Port": 587,
    "Username": "noreply@example.com",
    "Password": "your-smtp-password",
    "From": "noreply@example.com",
    "TemplatePath": "/app/email-templates"
  }
}
```

| Property | Default | Meaning |
|---|---|---|
| `UseSmtp` | `false` | `true` = real SMTP send; `false` = logging only |
| `Host` | `""` | SMTP server hostname |
| `Port` | `587` | SMTP port |
| `Username` | `""` | SMTP username |
| `Password` | `""` | SMTP password |
| `SecurityMode` | `StartTls` | Transport security, see [SMTP transport security](#smtp-transport-security) |
| `AllowInsecureTransport` | `false` | Permits `Auto`/`None` outside Development |
| `From` | `""` | Sender address |
| `TemplatePath` | `null` | Optional filesystem path for template overrides |

::: warning Password not in repository
The SMTP password belongs in User Secrets (development) or environment variable / secret manager (production). Never check it into `appsettings.json`.

```bash
dotnet user-secrets set "Email:Password" "your-password"
```
:::

## SMTP transport security

`Email:SecurityMode` selects how the connection to the SMTP server is secured:

| Value | Behaviour |
|---|---|
| `StartTls` (default) | Upgrade with STARTTLS, fail if the server does not offer it (port 587) |
| `SslOnConnect` | Implicit TLS from the first byte (port 465) |
| `Auto` | MailKit decides from port and server capabilities; a downgrade to plain text is possible |
| `None` | No encryption, intended for local mail catchers such as Mailpit |

`Auto` and `None` are rejected at startup (options validation) outside the `Development` environment.
A trusted internal relay can opt out explicitly with `Email:AllowInsecureTransport=true`; a warning is logged at startup.
The login is only attempted when `Username` is set and the server offers AUTH, so catchers without authentication work
with an empty `Username`.

```json
// appsettings.Development.json - local Mailpit without a certificate
{ "Email": { "UseSmtp": true, "Host": "localhost", "Port": 1025, "SecurityMode": "None" } }
```

## Rate limiting (opt-in)

`EmailModule` can optionally wrap the registered `IEmailSender` with a rate-limiting decorator.
The decorator is only active when at least one non-zero limit is configured under `Email:RateLimit`.
When disabled (the default), behaviour is identical to the undecorated sender.

```json
{
  "Email": {
    "RateLimit": {
      "MaxPerMinuteTotal": 10,
      "MaxPerHourTotal": 100,
      "MaxPerHourPerRecipient": 5
    }
  }
}
```

| Property | Default | Meaning |
|---|---|---|
| `MaxPerMinuteTotal` | `0` (off) | Maximum emails sent globally within any 60-second window |
| `MaxPerHourTotal` | `0` (off) | Maximum emails sent globally within any 60-minute window |
| `MaxPerHourPerRecipient` | `0` (off) | Maximum emails sent to a single `To` address within any 60-minute window |

When a limit is exceeded, `RateLimitedEmailSender` throws `EmailRateLimitExceededException`.
Catch it at the call site and surface a user-friendly message.

```csharp
try
{
    await emailSender.SendAsync(message, ct);
}
catch (EmailRateLimitExceededException ex)
{
    // ex.LimitKind: GlobalPerMinute | GlobalPerHour | PerRecipientPerHour
    logger.LogWarning("Email send blocked by rate limit: {Kind}", ex.LimitKind);
    // Return HTTP 429 / show user-friendly message
}
```

::: warning IP-based throttling belongs in the consumer, not here
`IEmailSender` has no knowledge of the caller's IP address.
IP-level throttling must be implemented at the HTTP request layer using
ASP.NET Core's built-in `AddRateLimiter` middleware on the endpoint that triggers the email send.
The email-layer limits above are complementary: they protect the SMTP relay from overall volume
and per-recipient spam, independent of network topology.
:::

## Development without SMTP

For local development, leave `UseSmtp: false`. The `LoggingEmailSender` writes all outgoing emails as `Information` log entries:

```
[LoggingEmailSender] Would send email to user@example.com with subject 'Reset password'.
```

## Configure template directory (filesystem overrides)

```json
{
  "Email": {
    "TemplatePath": "/app/email-templates"
  }
}
```

Place HTML files in the specified directory (e.g. `PasswordResetEmail.html`). The `FileSystemEmailTemplateProvider` (order 100) takes precedence over embedded resources (order 1000) but has lower priority than custom providers (order 0) and database overrides (order 2000).

::: info Database overrides take highest priority
When the Admin UI is in use, DB overrides (`DatabaseEmailTemplateProvider`, order 2000) win over filesystem files. See [Template Management](11-template-management.md).
:::
