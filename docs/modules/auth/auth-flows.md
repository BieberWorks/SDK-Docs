# Authentication Flows

## Dual-Scheme Concept

The Auth module registers three authentication schemes and automatically selects the appropriate one:

```
Incoming request
       |
       v
  "Smart" (PolicyScheme)
       |
       +-- Authorization header "Bearer …" present?
       |         |
       |         v
       |    JwtBearerDefaults  --> JWT validation
       |
       +-- otherwise
                 |
                 v
           CookieAuthenticationDefaults --> Cookie validation
```

The `Smart` scheme is the `DefaultScheme` and `DefaultChallengeScheme`. API clients send the Bearer header, Blazor Server clients use the cookie automatically.

## Login Flow (Cookie / Blazor Server)

Blazor Server runs over SignalR — inside an active circuit, HTTP cookies cannot be set. The module solves this with the **Ticket Store Pattern**:

1. The user submits a form to `LoginBase.HandleLoginAsync()`.
2. `InProcAuthClient.LoginAsync()` dispatches the `LoginCommand` via `IAppMessageDispatcher`.
3. `LoginCommandHandler` checks credentials, creates a `ClaimsPrincipal`, and stores it in `CookieSignInTicketStore` (in-memory, TTL 30 seconds). The store returns a `Guid` (ticket ID).
4. The handler returns the ticket as `TempAccessToken` in the `LoginResponse`.
5. `LoginBase` navigates with `forceLoad: true` to `/api/auth/finalize-login?ticket={id}&returnUrl={url}`.
6. This HTTP endpoint (outside the SignalR circuit) calls `HttpContext.SignInAsync()`, sets the cookie, and redirects to `returnUrl`.

```
Blazor Circuit          HTTP Endpoint
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

::: info Why forceLoad?
Inside a running SignalR circuit, `HttpContext.SignInAsync()` can no longer write the `Set-Cookie` header — the response is already committed. The `forceLoad` redirect creates a new HTTP request outside the circuit.
:::

## Login Flow (JWT / API Client)

For REST clients (e.g., WASM, MAUI, external apps), the same `POST /api/auth/login` endpoint returns a token pair:

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Secret#123"
}
```

Success response (`LoginResponseDto`):

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

The claims in the JWT are: `sub` (UserId), `email`, `jti`, and all roles as `role` claims.

## Token Refresh

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "accessToken": "eyJ…(expired)",
  "refreshToken": "base64…"
}
```

The `RefreshTokenCommandHandler` extracts claims from the expired access token (lifetime validation intentionally disabled), checks the refresh token in the database (not revoked, not expired), revokes the old one, and issues a new token pair.

## Registration

```http
POST /api/auth/register
Content-Type: application/json

{
  "firstName": "Max",
  "lastName": "Mustermann",
  "email": "max@example.com",
  "password": "Secret#123"
}
```

After successful registration, the `UserRegisteredEvent` is published. If an `IAuthEmailSender` is registered, `EmailConfirmationRequestedEventHandler` sends a confirmation email. The user can only fully log in after email confirmation (if email confirmation is enforced).

## Email Confirmation

When a user registers, an `EmailConfirmationRequestedEvent` is raised. `EmailConfirmationRequestedEventHandler` builds a link pointing to the Blazor confirm-email page:

```
{App:PublicBaseUrl}/auth/confirm-email?userId={id}&token={token}
```

The page (`/auth/confirm-email`) reads `userId` and `token` from the query string and calls `IAuthClient.ConfirmEmailAsync`. On success it shows a confirmation message with a link to `/auth/login`.

The API endpoint for direct (non-Blazor) confirmation still exists:

```http
POST /api/auth/confirm-email
Content-Type: application/json

{ "userId": "…", "token": "…" }
```

Alternatively, confirmation can be requested again:

```http
POST /api/auth/resend-confirmation
Content-Type: application/json

{ "userId": "…" }
```

## Password Flows

### Forgot password

```http
POST /api/auth/forgot-password
Content-Type: application/json

{ "email": "user@example.com" }
```

Always responds with `200 OK` (no disclosure whether the email address exists). The `PasswordResetRequestedEventHandler` sends a reset link via `IAuthEmailSender`.

### Reset password

```http
POST /api/auth/reset-password
Content-Type: application/json

{
  "email": "user@example.com",
  "token": "…(from email)",
  "newPassword": "NewSecret#456"
}
```

### Change password (logged-in user)

```http
POST /api/auth/change-password
Authorization: Bearer eyJ…
Content-Type: application/json

{
  "currentPassword": "Secret#123",
  "newPassword": "NewSecret#456"
}
```

## Two-Factor Authentication

The module ships an **email-based one-time-code (OTP)** second factor with single-use
recovery codes. It is delivered through the same template pipeline as the other
transactional emails (template key `auth:two-factor-code`).

### Enable 2FA

```http
POST /api/auth/2fa/enable
Authorization: Bearer eyJ…
Content-Type: application/json

{ "userId": "…" }
```

Enabling returns **8 single-use recovery codes**. They are shown **exactly once** — the
server stores only an HMAC-SHA256 hash (salted), never the plaintext. The management UI
on the Security page surfaces the remaining-code count and lets the user regenerate the
set (which invalidates the previous codes) or disable 2FA again.

### Login with 2FA

When credentials are valid and 2FA is enabled, the login response carries
`requires2FA: true` together with a short-lived **`tempAccessToken`** — a signed JWT with
`purpose: "2fa-pending"` that expires after 10 minutes. At the same time a fresh 6-digit
OTP is generated and emailed to the user. The client never receives or sends the raw
`userId`; the verify step derives the user from the temp token, so the second factor
cannot be completed for an arbitrary account.

```http
POST /api/auth/2fa/verify
Content-Type: application/json

{
  "tempAccessToken": "eyJ…",
  "code": "123456"
}
```

The `code` accepts either the emailed OTP **or** one of the recovery codes (consumed on
use). On success both transport paths — the in-process Blazor Server cookie flow and the
JWT/API flow — converge on the same finalize-login step a normal login uses, so the
resulting session is identical.

A new OTP can be requested via `POST /api/auth/2fa/resend` (subject to a 60-second
cooldown). Verification is brute-force protected: 5 failed attempts trigger a 15-minute
lockout. Both limits are enforced server-side by `ITwoFactorRateLimitService`.

> TOTP authenticator apps and WebAuthn/passkeys are intentionally out of scope for this
> email-OTP factor; they are tracked as separate follow-up work.

## IAuthEmailSender

The module uses `IAuthEmailSender` (from `Auth.Contracts`) for all email notifications:

```csharp
public interface IAuthEmailSender
{
    Task SendPasswordResetEmailAsync(string email, string customerName, string resetLink);
    Task SendEmailConfirmationAsync(string email, string customerName, string confirmationLink);
    Task SendTwoFactorCodeAsync(string email, string customerName, string code);
}
```

If no concrete `IAuthEmailSender` is registered in the DI container, the module falls back to `LoggingAuthEmailSender` — this only writes the links to the log (suitable for development).

If `SDK-Email` is installed and an `IEmailSender` is registered, `AuthEmailSenderAdapter` renders the bodies through `SDK-Email`'s rendering pipeline and sends them via `IEmailSender`.

::: tip Custom email implementation
Simply register your own `IAuthEmailSender` implementation **before** `AddBieberWorksModules`. The module uses `TryAdd` semantics and does not override already registered implementations.
:::

## Email templates in the Email admin UI

The Auth module registers its transactional emails as `IEmailTemplateDescriptor`s (from `BieberWorks.SDK.Email.Contracts`). When `SDK-Email` is present, this makes them appear in the **Email admin template list**, where they can be edited and overridden per locale without touching code.

| Key (`AuthEmailTemplateKeys`) | Display name | Group | Variables |
|---|---|---|---|
| `auth:password-reset` | Password reset | Authentication | `CustomerName`, `ResetLink` |
| `auth:email-confirmation` | E-mail confirmation | Authentication | `CustomerName`, `ConfirmationLink` |
| `auth:two-factor-code` | Two-factor sign-in code | Authentication | `CustomerName`, `Code` |

The descriptors expose the built-in HTML (read from the Auth assembly's embedded resources) as their `DefaultHtmlContent`. At send time `AuthEmailSenderAdapter` renders **by descriptor key**, so the Email module automatically applies, in order of precedence: a database override → the code default, then the active layout and branding variables (logo, brand colors, app name).

The registration is defensive: the descriptors are always registered, but when no Email module consumes `IEmailTemplateDescriptor` they are harmless no-ops. Auth therefore couples only to `BieberWorks.SDK.Email.Contracts` — never to the Email implementation — and remains runnable without `SDK-Email` (falling back to `LoggingAuthEmailSender`).
