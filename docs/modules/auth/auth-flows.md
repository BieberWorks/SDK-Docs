# Authentifizierungs-Flows

## Dual-Scheme Konzept

Das Auth-Modul registriert drei Authentication-Schemes und wählt automatisch das passende aus:

```
Eingehende Anfrage
       |
       v
  "Smart" (PolicyScheme)
       |
       +-- Authorization-Header "Bearer …" vorhanden?
       |         |
       |         v
       |    JwtBearerDefaults  --> JWT-Validierung
       |
       +-- sonst
                 |
                 v
           CookieAuthenticationDefaults --> Cookie-Validierung
```

Der `Smart`-Scheme ist der `DefaultScheme` und `DefaultChallengeScheme`. API-Clients senden den Bearer-Header, Blazor-Server-Clients nutzen das Cookie automatisch.

## Login-Flow (Cookie / Blazor Server)

Blazor Server läuft über SignalR — innerhalb eines aktiven Circuits können keine HTTP-Cookies gesetzt werden. Das Modul löst dies mit dem **Ticket-Store-Pattern**:

1. Der Benutzer sendet Formular an `LoginBase.HandleLoginAsync()`.
2. `InProcAuthClient.LoginAsync()` dispatcht den `LoginCommand` über `IAppMessageDispatcher`.
3. `LoginCommandHandler` prüft Credentials, erstellt ein `ClaimsPrincipal` und speichert es im `CookieSignInTicketStore` (In-Memory, TTL 30 Sekunden). Der Store gibt eine `Guid` (Ticket-ID) zurück.
4. Der Handler liefert das Ticket als `TempAccessToken` in der `LoginResponse`.
5. `LoginBase` navigiert mit `forceLoad: true` zu `/api/auth/finalize-login?ticket={id}&returnUrl={url}`.
6. Dieser HTTP-Endpoint (außerhalb des SignalR-Circuits) ruft `HttpContext.SignInAsync()` auf, setzt das Cookie und leitet auf `returnUrl` weiter.

```
Blazor Circuit          HTTP-Endpunkt
     |                       |
     | LoginCommand           |
     |---dispatch-----------> |
     |   Result{Ticket}       |
     |<---------------------- |
     |                        |
     | NavigateTo(finalize)   |
     |---forceLoad----------->|
     |              SignInAsync + Set-Cookie
     |              Redirect to returnUrl
```

::: info Warum forceLoad?
Innerhalb eines laufenden SignalR-Circuits kann `HttpContext.SignInAsync()` das `Set-Cookie`-Header nicht mehr schreiben — der Response ist bereits committed. Der `forceLoad`-Redirect erzeugt einen neuen HTTP-Request außerhalb des Circuits.
:::

## Login-Flow (JWT / API-Client)

Für REST-Clients (z. B. WASM, MAUI, externe Apps) liefert derselbe `POST /api/auth/login`-Endpoint ein Token-Paar:

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Geheim#123"
}
```

Erfolgsantwort (`LoginResponseDto`):

```json
{
  "userEmail": "user@example.com",
  "requires2FA": false,
  "tokenResponse": {
    "userEmail": "user@example.com",
    "accessToken": { "token": "eyJ…", "expiresAt": "2026-06-18T10:00:00Z" },
    "refreshToken": { "token": "base64…", "expiresAt": "2026-07-18T…" },
    "tokenType": "Bearer"
  }
}
```

Die Claims im JWT sind: `sub` (UserId), `email`, `jti`, und alle Rollen als `role`-Claims.

## Token-Refresh

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "accessToken": "eyJ…(abgelaufen)",
  "refreshToken": "base64…"
}
```

Der `RefreshTokenCommandHandler` extrahiert die Claims aus dem abgelaufenen Access-Token (Lifetime-Validierung bewusst deaktiviert), prüft den Refresh-Token in der Datenbank (nicht revoziert, nicht abgelaufen), revoziert den alten und stellt ein neues Token-Paar aus.

## Registrierung

```http
POST /api/auth/register
Content-Type: application/json

{
  "firstName": "Max",
  "lastName": "Mustermann",
  "email": "max@example.com",
  "password": "Geheim#123"
}
```

Nach erfolgreicher Registrierung wird der `UserRegisteredEvent` veröffentlicht. Wenn ein `IAuthEmailSender` registriert ist, versendet `EmailConfirmationRequestedEventHandler` eine Bestätigungs-E-Mail. Der Benutzer kann sich erst vollständig einloggen, wenn die E-Mail bestätigt wurde (sofern Email-Bestätigung erzwungen wird).

## E-Mail-Bestätigung

Der Bestätigungslink enthält `userId` und `token`:

```http
GET /api/auth/confirm-email?userId={id}&token={token}
```

Alternativ kann die Bestätigung erneut angefordert werden:

```http
POST /api/auth/resend-confirmation
Content-Type: application/json

{ "userId": "…" }
```

## Passwort-Flows

### Passwort vergessen

```http
POST /api/auth/forgot-password
Content-Type: application/json

{ "email": "user@example.com" }
```

Antwortet immer mit `200 OK` (keine Preisgabe, ob die E-Mail-Adresse existiert). Der `PasswordResetRequestedEventHandler` versendet einen Reset-Link per `IAuthEmailSender`.

### Passwort zurücksetzen

```http
POST /api/auth/reset-password
Content-Type: application/json

{
  "email": "user@example.com",
  "token": "…(aus E-Mail)",
  "newPassword": "NeuesGeheim#456"
}
```

### Passwort ändern (eingeloggter Benutzer)

```http
POST /api/auth/change-password
Authorization: Bearer eyJ…
Content-Type: application/json

{
  "currentPassword": "Geheim#123",
  "newPassword": "NeuesGeheim#456"
}
```

## Zwei-Faktor-Authentifizierung

### 2FA aktivieren

```http
POST /api/auth/2fa/enable
Authorization: Bearer eyJ…
Content-Type: application/json

{ "userId": "…" }
```

### Login mit 2FA

Nach einem Login-Versuch, wenn `requires2FA: true` zurückkommt:

```http
POST /api/auth/2fa/verify
Content-Type: application/json

{
  "userId": "…",
  "code": "123456"
}
```

## IAuthEmailSender

Das Modul verwendet `IAuthEmailSender` (aus `Auth.Contracts`) für alle E-Mail-Benachrichtigungen:

```csharp
public interface IAuthEmailSender
{
    Task SendPasswordResetEmailAsync(string email, string customerName, string resetLink);
    Task SendEmailConfirmationAsync(string email, string customerName, string confirmationLink);
}
```

Ist kein konkreter `IAuthEmailSender` im DI-Container registriert, fällt das Modul auf `LoggingAuthEmailSender` zurück — dieser schreibt die Links nur ins Log (geeignet für die Entwicklung).

Ist `SDK-Email` installiert und ein `IEmailSender` registriert, verwendet `AuthEmailSenderAdapter` automatisch die Email-Templates aus den eingebetteten Ressourcen des Auth-Moduls.

::: tip Eigene E-Mail-Implementierung
Registriere einfach eine eigene `IAuthEmailSender`-Implementierung **vor** `AddBieberWorksModules`. Das Modul prüft mit `TryAdd`-Semantik und überschreibt bereits registrierte Implementierungen nicht.
:::
