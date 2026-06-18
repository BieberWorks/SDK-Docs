# Verwendung — SDK-Email

## IEmailSender — E-Mail senden

`IEmailSender` ist als Scoped-Service registriert. `SendAsync` erwartet ein `EmailMessage`-Record:

```csharp
using BieberWorks.SDK.Email.Contracts;

public class NotificationService(IEmailSender emailSender)
{
    public async Task SendWelcomeEmailAsync(string to, CancellationToken ct = default)
    {
        var message = new EmailMessage(
            To:       to,
            Subject:  "Willkommen bei MyApp",
            HtmlBody: "<h1>Herzlich willkommen!</h1><p>Dein Konto wurde erstellt.</p>");

        await emailSender.SendAsync(message, ct);
    }
}
```

`EmailMessage` ist ein `record` mit folgenden Properties:

| Property | Typ | Pflicht | Bedeutung |
|---|---|---|---|
| `To` | `string` | Ja | Empfänger-E-Mail-Adresse |
| `Subject` | `string` | Ja | Betreff |
| `HtmlBody` | `string` | Ja | HTML-Inhalt der E-Mail |
| `Attachments` | `IReadOnlyList<EmailAttachment>?` | Nein | Optionale Anhänge |

## E-Mail mit Anhang senden

```csharp
var pdfBytes = await GeneratePdfAsync();

var message = new EmailMessage(
    To:      "user@example.com",
    Subject: "Ihre Rechnung",
    HtmlBody: "<p>Im Anhang finden Sie Ihre Rechnung.</p>",
    Attachments: new[]
    {
        new EmailAttachment(
            FileName:    "Rechnung.pdf",
            Data:        pdfBytes,
            ContentType: "application/pdf")
    });

await emailSender.SendAsync(message, ct);
```

## IEmailTemplateRenderer — Templates verwenden

`IEmailTemplateRenderer.Render` ersetzt `{{Key}}`-Platzhalter in einer HTML-Template-Datei:

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

        var message = new EmailMessage(to, "Passwort zurücksetzen", html);
        await emailSender.SendAsync(message, ct);
    }
}
```

Das Template `PasswordResetEmail.html` enthält Platzhalter in doppelten geschweiften Klammern:

```html
<!DOCTYPE html>
<html>
<body>
  <p>Klicke auf den Link um dein Passwort zurückzusetzen:</p>
  <a href="{{ResetLink}}">Passwort zurücksetzen</a>
  <p><small>Diese E-Mail wurde an {{UserEmail}} gesendet.</small></p>
</body>
</html>
```

::: warning Exception bei fehlendem Template
`IEmailTemplateRenderer.Render` wirft eine `InvalidOperationException`, wenn kein Provider das Template liefern kann. Stelle sicher, dass das Template entweder als Embedded Resource oder im konfigurierten `TemplatePath` vorhanden ist.
:::

## IEmailTemplateProvider — Eigene Provider registrieren

### Eingebettete Ressourcen aus eigener Assembly

```csharp
using BieberWorks.SDK.Email.Contracts;

// In Program.cs oder einem IModule:
services.AddSingleton<IEmailTemplateProvider>(
    new EmbeddedEmailTemplateProvider(
        assembly:          typeof(MyModuleMarker).Assembly,
        resourceNamespace: "MyApp.Templates.Email",
        order:             EmailTemplateProviderOrder.Embedded));
```

Die Ressource-Datei `PasswordResetEmail.html` muss als `EmbeddedResource` im Projekt liegen:

```xml
<!-- MyModule.csproj -->
<ItemGroup>
    <EmbeddedResource Include="Templates\Email\PasswordResetEmail.html" />
</ItemGroup>
```

### Eigener Custom-Provider (höchste Priorität)

```csharp
public sealed class DatabaseEmailTemplateProvider : IEmailTemplateProvider
{
    public int Order => EmailTemplateProviderOrder.Custom; // 0 = höchste Priorität

    public string? TryGetTemplate(string templateName)
    {
        // Aus DB laden, null zurückgeben wenn nicht gefunden
        return _db.EmailTemplates.FirstOrDefault(t => t.Name == templateName)?.HtmlContent;
    }
}

// Registrierung
services.AddSingleton<IEmailTemplateProvider, DatabaseEmailTemplateProvider>();
```

## Provider-Priorität im Überblick

```
Render("PasswordResetEmail.html")
    │
    ├─ Custom-Provider (Order 0)          → gefunden? → rendern
    ├─ FileSystemEmailTemplateProvider    → Email:TemplatePath/<name>.html vorhanden? → rendern
    ├─ EmbeddedEmailTemplateProvider      → Embedded Resource vorhanden? → rendern
    └─ kein Provider hat Treffer          → InvalidOperationException
```

## SMTP-Verbindung

`SmtpEmailSender` verwendet **MailKit** mit STARTTLS (Port 587). Verbindungsaufbau, Authentifizierung und Trennung erfolgen pro `SendAsync`-Aufruf. Der Sender ist als Scoped registriert.

::: info Logging
Sowohl `SmtpEmailSender` (nach erfolgreichem Versand) als auch `LoggingEmailSender` (anstelle des Versands) schreiben einen `Information`-Log-Eintrag mit Empfänger und Betreff.
:::
