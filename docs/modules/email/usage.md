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

### RenderAsync — branding-aware async variant

Use `RenderAsync` instead of `Render` when you want the email logo URL injected automatically. If `IBrandingService` (from `SDK-Theme`) is registered, the renderer fetches the branding email logo URL and injects it into a `{{LogoUrl}}` placeholder. Caller-supplied variables always take precedence.

```csharp
var html = await renderer.RenderAsync("PasswordResetEmail.html", new Dictionary<string, string>
{
    ["ResetLink"] = resetLink,
    ["UserEmail"] = to,
    // {{LogoUrl}} is injected automatically from IBrandingService if registered
}, ct);
```

This is the preferred method for production use. `Render` (sync) remains available for test stubs or contexts where branding is not needed.

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

## ISubmissionNotifier — Dual-recipient submission notifications

`ISubmissionNotifier` encapsulates the "render two templates → send customer + admin email →
catch-and-log send failures" pattern that recurs across contact forms, inquiry forms, and
similar submission flows. It is registered as a scoped service by `EmailModule`.

### Why use it

Without `ISubmissionNotifier` each form handler duplicates the same render-send-catch logic.
A transient SMTP failure in one of those copies can bubble up and fail the whole submission.
`ISubmissionNotifier` isolates the two sends: a failure on the customer email is logged and
swallowed; the admin email is still attempted. Neither failure is rethrown.

### Preferred: typed overload (`DualNotification<TModel>`)

Pass a strongly-typed model instead of a string dictionary. The implementation reflects the
model's public properties into `{{PropertyName}}` placeholder values automatically.

```csharp
using BieberWorks.SDK.Email.Contracts;

public sealed class ContactFormModel
{
    public string Name    { get; init; } = string.Empty;
    public string Email   { get; init; } = string.Empty;
    public string Message { get; init; } = string.Empty;
}

public class ContactFormHandler(ISubmissionNotifier notifier)
{
    public async Task HandleAsync(ContactFormModel form, CancellationToken ct = default)
    {
        // Business logic …

        var notification = new DualNotification<ContactFormModel>(
            CustomerEmail:    form.Email,
            CustomerTemplate: "ContactConfirmation.html",
            CustomerSubject:  "Thank you for your message",
            AdminEmail:       "team@example.com",
            AdminTemplate:    "ContactAdminAlert.html",
            AdminSubject:     "New contact form submission",
            Model:            form,
            LogContext:       "ContactForm");

        await notifier.NotifyAsync(notification, ct);
        // Never throws — send errors are logged internally.
    }
}
```

### Fallback: untyped overload (`DualNotification`)

Use the untyped variant for ad-hoc or dynamic cases where a typed model is not available.
All placeholder values must be provided as a flat `IReadOnlyDictionary<string, string>`.

```csharp
var notification = new DualNotification(
    CustomerEmail:    "user@example.com",
    CustomerTemplate: "ContactConfirmation.html",
    CustomerSubject:  "Thank you for your message",
    AdminEmail:       "team@example.com",
    AdminTemplate:    "ContactAdminAlert.html",
    AdminSubject:     "New contact form submission",
    Variables:        new Dictionary<string, string>
    {
        ["Name"]    = model.Name,
        ["Email"]   = model.Email,
        ["Message"] = model.Message,
    },
    LogContext: "ContactForm");

await notifier.NotifyAsync(notification, ct);
```

### Omitting the admin email

Set `AdminEmail` to `null` to skip the admin notification entirely. Only the customer email
is sent.

```csharp
var notification = new DualNotification<ContactFormModel>(
    CustomerEmail:    form.Email,
    CustomerTemplate: "ContactConfirmation.html",
    CustomerSubject:  "Thank you for your message",
    AdminEmail:       null,          // no admin email
    AdminTemplate:    string.Empty,  // ignored when AdminEmail is null
    AdminSubject:     string.Empty,
    Model:            form,
    LogContext:       "ContactFormNoAdmin");

await notifier.NotifyAsync(notification, ct);
```

### Error-tolerant behaviour

Both the customer send and the admin send are wrapped in independent try/catch blocks.
An SMTP failure in either is logged at `Error` level (keyed by `LogContext`) and does not
propagate. The caller's submission flow continues regardless of email-delivery failures.

---

## SMTP connection

`SmtpEmailSender` uses **MailKit** with STARTTLS (port 587). Connection setup, authentication, and teardown occur per `SendAsync` call. The sender is registered as scoped.

::: info Logging
Both `SmtpEmailSender` (after successful send) and `LoggingEmailSender` (instead of send) write an `Information` log entry with recipient and subject.
:::
