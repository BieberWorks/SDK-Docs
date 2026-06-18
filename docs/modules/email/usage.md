# Usage — SDK-Email

## IEmailSender — Send email

`IEmailSender` is registered as a scoped service. `SendAsync` expects an `EmailMessage` record:

```csharp
using BieberWorks.SDK.Email.Contracts;

public class NotificationService(IEmailSender emailSender)
{
    public async Task SendWelcomeEmailAsync(string to, CancellationToken ct = default)
    {
        var message = new EmailMessage(
            To:       to,
            Subject:  "Welcome to MyApp",
            HtmlBody: "<h1>Welcome!</h1><p>Your account has been created.</p>");

        await emailSender.SendAsync(message, ct);
    }
}
```

`EmailMessage` is a `record` with the following properties:

| Property | Type | Required | Meaning |
|---|---|---|---|
| `To` | `string` | Yes | Recipient email address |
| `Subject` | `string` | Yes | Subject line |
| `HtmlBody` | `string` | Yes | HTML content of the email |
| `Attachments` | `IReadOnlyList<EmailAttachment>?` | No | Optional attachments |

## Send email with attachment

```csharp
var pdfBytes = await GeneratePdfAsync();

var message = new EmailMessage(
    To:      "user@example.com",
    Subject: "Your invoice",
    HtmlBody: "<p>Please find your invoice attached.</p>",
    Attachments: new[]
    {
        new EmailAttachment(
            FileName:    "Invoice.pdf",
            Data:        pdfBytes,
            ContentType: "application/pdf")
    });

await emailSender.SendAsync(message, ct);
```

## IEmailTemplateRenderer — Use templates

`IEmailTemplateRenderer.Render` replaces `{{Key}}` placeholders in an HTML template file:

```csharp
using BieberWorks.SDK.Email.Contracts;

public class PasswordResetService(
    IEmailSender emailSender,
    IEmailTemplateRenderer renderer)
{
    public async Task SendResetEmailAsync(string to, string resetLink, CancellationToken ct = default)
    {
        var html = renderer.Render("PasswordResetEmail.html", new Dictionary<string, string>
        {
            ["ResetLink"] = resetLink,
            ["UserEmail"] = to,
        });

        var message = new EmailMessage(to, "Reset password", html);
        await emailSender.SendAsync(message, ct);
    }
}
```

The template `PasswordResetEmail.html` contains placeholders in double curly braces:

```html
<!DOCTYPE html>
<html>
<body>
  <p>Click the link to reset your password:</p>
  <a href="{{ResetLink}}">Reset password</a>
  <p><small>This email was sent to {{UserEmail}}.</small></p>
</body>
</html>
```

::: warning Exception if template is missing
`IEmailTemplateRenderer.Render` throws an `InvalidOperationException` if no provider can supply the template. Ensure the template exists either as an embedded resource or in the configured `TemplatePath`.
:::

## IEmailTemplateProvider — Register custom providers

### Embedded resources from own assembly

```csharp
using BieberWorks.SDK.Email.Contracts;

// In Program.cs or an IModule:
services.AddSingleton<IEmailTemplateProvider>(
    new EmbeddedEmailTemplateProvider(
        assembly:          typeof(MyModuleMarker).Assembly,
        resourceNamespace: "MyApp.Templates.Email",
        order:             EmailTemplateProviderOrder.Embedded));
```

The resource file `PasswordResetEmail.html` must exist as `EmbeddedResource` in the project:

```xml
<!-- MyModule.csproj -->
<ItemGroup>
    <EmbeddedResource Include="Templates\Email\PasswordResetEmail.html" />
</ItemGroup>
```

### Custom provider (highest priority)

```csharp
public sealed class DatabaseEmailTemplateProvider : IEmailTemplateProvider
{
    public int Order => EmailTemplateProviderOrder.Custom; // 0 = highest priority

    public string? TryGetTemplate(string templateName)
    {
        // Load from DB, return null if not found
        return _db.EmailTemplates.FirstOrDefault(t => t.Name == templateName)?.HtmlContent;
    }
}

// Registration
services.AddSingleton<IEmailTemplateProvider, DatabaseEmailTemplateProvider>();
```

## Provider priority overview

```
Render("PasswordResetEmail.html")
    │
    ├─ Custom provider (order 0)          → found? → render
    ├─ FileSystemEmailTemplateProvider    → Email:TemplatePath/<name>.html exists? → render
    ├─ EmbeddedEmailTemplateProvider      → Embedded resource exists? → render
    └─ no provider has match              → InvalidOperationException
```

## SMTP connection

`SmtpEmailSender` uses **MailKit** with STARTTLS (port 587). Connection setup, authentication, and teardown occur per `SendAsync` call. The sender is registered as scoped.

::: info Logging
Both `SmtpEmailSender` (after successful send) and `LoggingEmailSender` (instead of send) write an `Information` log entry with recipient and subject.
:::
