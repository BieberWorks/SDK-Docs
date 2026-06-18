# Setup — SDK-Email

## NuGet-Pakete installieren

```xml
<!-- Host .csproj -->
<PackageReference Include="BieberWorks.SDK.Email" Version="0.*-*" />
```

::: tip Contracts für andere Module
Module, die `IEmailSender` injizieren (z. B. Auth für Passwort-Reset):
```xml
<PackageReference Include="BieberWorks.SDK.Email.Contracts" Version="0.*-*" />
```
:::

## Program.cs

`EmailModule` registriert sich als `IModule` und wird von `AddBieberWorksModules` automatisch erfasst. Kein zusätzlicher Aufruf nötig:

```csharp
// Alle Module laden — EmailModule wird automatisch eingeschlossen
builder.Services.AddBieberWorksModules(builder.Configuration);
```

Das Modul liest beim Start `Email:UseSmtp` aus der Konfiguration:
- `UseSmtp: true` → `SmtpEmailSender` wird als `IEmailSender` registriert
- `UseSmtp: false` (Standard) → `LoggingEmailSender` wird registriert (kein echter Versand)

## SMTP-Konfiguration in appsettings.json

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

| Property | Standard | Bedeutung |
|---|---|---|
| `UseSmtp` | `false` | `true` = echter SMTP-Versand; `false` = nur Logging |
| `Host` | `""` | SMTP-Server-Hostname |
| `Port` | `587` | SMTP-Port (STARTTLS) |
| `Username` | `""` | SMTP-Benutzername |
| `Password` | `""` | SMTP-Passwort |
| `From` | `""` | Absender-Adresse |
| `TemplatePath` | `null` | Optionaler Dateisystem-Pfad für Template-Overrides |

::: warning Password nicht im Repository
Das SMTP-Passwort gehört in User Secrets (Entwicklung) oder eine Environment Variable / einen Secret Manager (Produktion). Niemals in `appsettings.json` einchecken.

```bash
dotnet user-secrets set "Email:Password" "dein-passwort"
```
:::

### Entwicklung ohne SMTP

Für lokale Entwicklung `UseSmtp: false` lassen. Der `LoggingEmailSender` schreibt alle ausgehenden E-Mails als `Information`-Log:

```
[LoggingEmailSender] Would send email to user@example.com with subject 'Passwort zurücksetzen'.
```

## Template-Verzeichnis konfigurieren

Wenn Template-Overrides per Dateisystem bereitgestellt werden sollen:

```json
{
  "Email": {
    "TemplatePath": "/app/email-templates"
  }
}
```

Lege HTML-Dateien im angegebenen Verzeichnis ab (z. B. `PasswordResetEmail.html`). Der `FileSystemEmailTemplateProvider` (Order 100) hat Vorrang vor eingebetteten Ressourcen (Order 1000), aber geringere Priorität als eigene Custom-Provider (Order 0).
