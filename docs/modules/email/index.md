# SDK-Email

Das Modul **BieberWorks.SDK.Email** stellt einen MailKit-basierten SMTP-Versand sowie ein Template-System für transaktionale E-Mails bereit. Ohne Konfiguration (`UseSmtp: false`) fällt das Modul automatisch auf einen `LoggingEmailSender` zurück, der ausgehende E-Mails nur ins Log schreibt — praktisch für lokale Entwicklung.

## Pakete

| NuGet-Paket | Inhalt | Referenzieren |
|---|---|---|
| `BieberWorks.SDK.Email.Contracts` | `IEmailSender`, `IEmailTemplateProvider`, `IEmailTemplateRenderer`, `EmailMessage`, `EmailAttachment`, `EmailSettings`, `EmbeddedEmailTemplateProvider`, `EmailTemplateProviderOrder` | andere Module |
| `BieberWorks.SDK.Email` | `EmailModule`, `SmtpEmailSender`, `LoggingEmailSender`, `FileSystemEmailTemplateProvider`, `EmailTemplateRenderer` | Host |

**Aktuelle Version:** `v0.0.5`

## Interfaces im Überblick

| Interface | Registrierung | Zweck |
|---|---|---|
| `IEmailSender` | Scoped | E-Mail senden (`SendAsync`) |
| `IEmailTemplateRenderer` | Singleton | Template rendern (`Render`) |
| `IEmailTemplateProvider` | Singleton, mehrere möglich | Template-HTML liefern (`TryGetTemplate`) |

## Template-Provider-Priorität

Mehrere `IEmailTemplateProvider` können registriert sein. Der mit dem niedrigsten `Order`-Wert gewinnt.

| Provider | Order | Aktivierung |
|---|---|---|
| Custom (eigene Implementierung) | `0` | Manuell registriert |
| `FileSystemEmailTemplateProvider` | `100` | Automatisch; aktiv wenn `Email:TemplatePath` gesetzt |
| `EmbeddedEmailTemplateProvider` | `1000` | Manuell registriert, z. B. durch Auth-Modul |

Der `FileSystemEmailTemplateProvider` gibt `null` zurück (kein Fehler), wenn der Pfad nicht konfiguriert ist oder die Datei nicht existiert — dann wird der nächste Provider versucht.

## Abhängigkeiten

Das Modul hängt von keinem anderen Fachmodul ab (kein Auth, kein Audit). Es benötigt nur `BieberWorks.SDK.Core`.
