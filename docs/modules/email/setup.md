# Setup — SDK-Email

## NuGet packages

```xml
<!-- Host .csproj -->
<PackageReference Include="BieberWorks.SDK.Email" Version="0.*-*" />
```

::: tip Contracts for other modules
Modules that inject `IEmailSender` (e.g. Auth for password reset):
```xml
<PackageReference Include="BieberWorks.SDK.Email.Contracts" Version="0.*-*" />
```
:::

## Program.cs

`EmailModule` registers itself as `IModule` and is automatically captured by `AddBieberWorksModules`. No additional call necessary:

```csharp
// Load all modules — EmailModule is automatically included
builder.Services.AddBieberWorksModules(builder.Configuration);
```

The module reads `Email:UseSmtp` from the configuration on startup:
- `UseSmtp: true` → `SmtpEmailSender` is registered as `IEmailSender`
- `UseSmtp: false` (default) → `LoggingEmailSender` is registered (no actual send)

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
| `Port` | `587` | SMTP port (STARTTLS) |
| `Username` | `""` | SMTP username |
| `Password` | `""` | SMTP password |
| `From` | `""` | Sender address |
| `TemplatePath` | `null` | Optional filesystem path for template overrides |

::: warning Password not in repository
The SMTP password belongs in User Secrets (development) or environment variable / secret manager (production). Never check into `appsettings.json`.

```bash
dotnet user-secrets set "Email:Password" "your-password"
```
:::

### Development without SMTP

For local development, leave `UseSmtp: false`. The `LoggingEmailSender` writes all outgoing emails as `Information` log:

```
[LoggingEmailSender] Would send email to user@example.com with subject 'Reset password'.
```

## Configure template directory

If template overrides are to be provided via filesystem:

```json
{
  "Email": {
    "TemplatePath": "/app/email-templates"
  }
}
```

Place HTML files in the specified directory (e.g. `PasswordResetEmail.html`). The `FileSystemEmailTemplateProvider` (order 100) takes precedence over embedded resources (order 1000), but has lower priority than custom providers (order 0).
