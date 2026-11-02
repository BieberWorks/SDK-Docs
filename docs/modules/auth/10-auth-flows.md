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
3. `InProcAuthClient.LoginAsync()` verifies the credentials through the Identity `UserManager` and builds the `ClaimsPrincipal` (`BuildAndStoreTicket`). The principal is stored in the `ICookieSignInTicketStore` (in-memory, single use, TTL 30 seconds); the store returns a `Guid` (ticket ID).
4. The ticket is returned to the caller as `AuthResult.Token`.
5. `LoginViewModel` navigates through `IAuthNavigator.NavigateToFinalizeLogin` (forceLoad) to `/api/auth/finalize-login?ticket={id}&returnUrl={url}`.
6. This HTTP endpoint (outside the SignalR circuit) starts a server-side session (`auth.UserSessions`), adds its id as the `sid` claim, calls `HttpContext.SignInAsync()` with the absolute session end as ticket expiry, sets the cookie, and redirects to `returnUrl`. From then on every request validates the session; see [Sessions](14-sessions.md).

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

### Logout

`/auth/logout` navigates (forceLoad) to `GET /api/auth/signout`, which ends the server-side session identified by the cookie (also when the cookie has expired), deletes the cookie and redirects to `/auth/login`. Requests marked `Sec-Fetch-Site: cross-site` are ignored. Details in [Sessions](14-sessions.md#sign-out).

## Anonymous page requests

When an anonymous request reaches a protected page, the cookie scheme redirects the browser to the login page instead of answering `401`: `302 <PathBase>/auth/login?returnUrl=<escaped PathBase+Path+Query>`. The `Location` is always relative.

A request is treated as a browser navigation only if **all** of these hold: method is `GET` or `HEAD`; the `Accept` header contains `text/html` (this includes Blazor enhanced navigation, `text/html; blazor-enhanced-nav=on`); there is no `X-Requested-With: XMLHttpRequest`; no `Upgrade: websocket`; and the path is not under one of `NoRedirectPathPrefixes`. Everything else (fetch with `*/*`, JSON, XHR, `/api/...`, the Blazor circuit, POST) keeps `401`.

- The login redirect applies to the anonymous case only. Signed-in users without permission are redirected the same way to `AccessDeniedPath` (default `/auth/access-denied`, a page shipped in `Auth.UI.Blazor.MudBlazor`). A forbidden request that is not a browser navigation keeps `403`.
- No `returnUrl` is added for requests below the target path; a challenge of the target page itself answers `401` or `403` to avoid a redirect loop.
- API-only hosts clear `LoginPath` and `AccessDeniedPath`; see [Cookie configuration](01-getting-started.md#cookie-configuration) for the options, the `Domain` risk and the `SameSite=Strict` behaviour for links from other sites.

### Interactive circuit path

The redirect above only runs for HTTP requests. With a global interactive render mode (`<Routes @rendermode="InteractiveServer" />`), a click on a protected link inside an established circuit is handled by the client-side router and never passes the cookie `OnRedirectToLogin` event. Without extra handling the anonymous user stays on the protected page. Use `BwAuthorizeRouteView` (SDK-UI, `BieberWorks.SDK.UI.Blazor.MudBlazor`) instead of `AuthorizeRouteView` in `Routes.razor`: anonymous users are sent to the login page with `NavigateTo(..., forceLoad: true, replace: true)` and a validated local `returnUrl`; shell layouts (`BwShellLayoutBase`, SDK-Shell) do the same via `RequireAuthenticatedUser` / `RequirePolicy`.

The two redirects must agree on the login page: `LoginRedirectOptions.LoginPath` (SDK-UI, default `/auth/login`) has to equal `AuthCookieOptions.LoginPath` (default `/auth/login`). If you change one, change the other. The `returnUrl` rule in SDK-UI mirrors `ReturnUrlValidator.IsLocal`; see [Anonymous access in interactive circuits](../ui/50-components.md#anonymous-access-in-interactive-circuits).

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

### Return URL rules

The `returnUrl` is validated twice with the public helper `ReturnUrlValidator` (`BieberWorks.SDK.Auth.Contracts`): by `LoginBase` and again by `finalize-login`. `ReturnUrlValidator.Sanitize(url, allowedOrigins, fallback)` returns the URL if it is acceptable and the fallback otherwise; `IsLocal(url)` and `IsAllowed(url, origins)` are the underlying checks. The two-argument `Sanitize(url, fallback = "/")` accepts local URLs only.

A **local** return URL is accepted only if all of the following hold:

- It starts with `/`.
- The second character is neither `/` nor `\` (rejects `//host` and `/\host`).
- It contains no control characters anywhere (tab, CR, LF, ...).

An **absolute** return URL (for example to another application of the same organisation) is accepted only if its origin is listed in `BieberWorks:Auth:ReturnUrl:AllowedReturnOrigins` (see [Setup](01-getting-started.md#return-url-configuration)). The URL must additionally satisfy:

- Scheme `http` or `https`; no user info; no backslash, control or whitespace characters in the raw string.
- Scheme, host (compared in its IDN/punycode form, case-insensitive) and port (default ports normalized) equal an allow-list entry. A host with a trailing dot never matches. A fragment is allowed.

The accepted absolute URL is returned in its normalized ASCII form so the `Location` header is always valid. Allow-list entries must be plain `scheme://host[:port]` origins; wildcards, paths and user info are rejected at startup. Everything else falls back to `/`: `null`/empty values, other origins, `javascript:`, host-relative values (`evil.com`), `//host`, a leading space, a backslash start, and the virtual-path form `~/...` (stricter than `IUrlHelper.IsLocalUrl`).

Non-ASCII characters in local paths (for example `/ä`) are percent-encoded in the redirect `Location` header.

If the ticket passed to `finalize-login` is unknown or expired, the endpoint redirects to `/auth/login`. A valid, non-root return URL (including an allowed absolute one) is preserved as `/auth/login?returnUrl=<escaped>`; an invalid one is dropped.

### Login rate limiting behind a proxy

The login rate limiter partitions by the connection's `RemoteIpAddress` and the submitted identifier. The `X-Forwarded-For` header is **not** evaluated, because it is client-controlled and would let an attacker rotate the partition key. Hosts behind a reverse proxy or load balancer must call `UseForwardedHeaders` (with the proxy addresses configured as known proxies) so that ASP.NET Core resolves the real client address into `RemoteIpAddress`.

Without it, all clients share the proxy's IP and therefore one bucket per identifier; the per-account counter keyed by the identifier stays effective.

### Account lockout

A locked-out account (ASP.NET Core Identity lockout, set by an administrator or by Identity itself) is rejected consistently:

| Flow | Behavior |
|------|----------|
| Login (`LoginCommandHandler`) | After the password has been verified, a locked account returns `Identity.Login.LockedOut` (HTTP 403, `DomainError.Forbidden`). No token and no 2FA code is issued. The attempt is not counted by the login rate limiter. |
| 2FA verify | `Identity.Login.LockedOut` (403) before the recovery code or OTP is checked. |
| Token refresh | `Identity.Login.LockedOut` (403); the submitted refresh token is revoked. |

A wrong password or an unknown user always yields `Identity.Login.Unauthorized`, whether or not the account is locked, so the lock state does not leak to unauthenticated callers. The localized message `Identity.Login.LockedOut` ships with `Auth.Presentation` and `Auth.UI.Blazor`.

::: warning What lockout does not do
- Access tokens that were already issued stay valid until they expire (`AccessTokenExpirationMinutes`).

Locking a user ends all of the user's cookie sessions (see [Sessions](14-sessions.md)); the validator also rejects a locked user whatever the cause of the lock. Unlocking does not bring the sessions back.

Use short access-token lifetimes (15 minutes or less) if immediate revocation of Bearer clients matters.
:::

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

`email` and `password` are required; `firstName` and `lastName` are optional (maximum 100 characters). See [Request fields](11-registration.md#request-fields).

After successful registration, the `UserRegisteredEvent` is published. `EmailConfirmationRequestedEventHandler` queues the confirmation email for background delivery (see [Background mail delivery](#background-mail-delivery) and [Transactional emails](#transactional-emails)). By default, registration returns a token pair and the user can sign in without confirming the address. Enforcement is opt-in; see [Email confirmation enforcement](#email-confirmation-enforcement).

With `Auth:Registration:UniformResponse` set to `true` the answer no longer depends on the state of the address: it never contains tokens, always has `RequiresEmailConfirmation = true` and returns the address exactly as entered. A confirmed address no longer yields `409`; see [Uniform registration response](11-registration.md#uniform-registration-response).

Registration (`POST /api/auth/register`, also through `InProcAuthClient`) is limited per client IP (10 per 15 minutes, policy `auth:register-ip`) in both modes. The limit applies only when the IP is known; without an `HttpContext` (for example in a Blazor Interactive Server circuit) there is no bucket at all, never a shared "unknown" one. The excess answer is `429` with `Identity.Register.RateLimited`.

## Email Confirmation

When a user registers, an `EmailConfirmationRequestedEvent` is raised. `EmailConfirmationRequestedEventHandler` builds a link pointing to the Blazor confirm-email page:

```
{App:PublicBaseUrl}/auth/confirm-email?userId={id}&token={token}
```

The page (`/auth/confirm-email`) reads `userId` and `token` from the query string but does **not** confirm on load. It shows a button, and only the click (an `EditForm` submit that works in interactive mode and static SSR) calls `IAuthClient.ConfirmEmailAsync`. Mail scanners, link previews, browser prefetch and the double render of a prerendered circuit therefore cannot consume the token. The link format is unchanged, so mails that were already sent keep working. `ConfirmEmailViewModel.Prepare` moves to `ConfirmEmailState.Ready`; `ConfirmCommand` performs the call and ignores a second invocation while busy. On success the page shows a message with a link to `/auth/login`.

Confirmation is idempotent: repeating the link of an account that is already confirmed (reload, double click, second device) succeeds. A token that has expired, belongs to another user, or was consumed while the account is still unconfirmed remains an error.

The API endpoint for direct (non-Blazor) confirmation still exists:

```http
POST /api/auth/confirm-email
Content-Type: application/json

{ "userId": "…", "token": "…" }
```

Alternatively, confirmation can be requested again. The endpoint requires authentication and has no body; the user id is taken from the authenticated principal:

```http
POST /api/auth/resend-confirmation
Authorization: Bearer eyJ…
```

### Anonymous confirmation-email request

Users who cannot sign in because the address is unconfirmed (see [Email confirmation enforcement](#email-confirmation-enforcement)) have no session, so the authenticated `resend-confirmation` endpoint is not usable for them. For that case:

```http
POST /api/auth/request-confirmation-email
Content-Type: application/json

{ "identifier": "user@example.com" }
```

`identifier` is the email address or user name. The endpoint is anonymous and **always** answers `200 OK` with the same message and a fixed `cooldownSeconds` (60), whether the account is unknown, already confirmed, still cooling down, or the request was throttled. The request itself only checks the two limits below and queues one `ConfirmationRequestJob`; it never reads the account. The mail worker then looks the account up and creates a token and raises `EmailConfirmationRequestedEvent` only for an existing, unconfirmed account whose per-account cooldown (`IResendConfirmationRateLimitService`) has elapsed.

Two `IRateLimiter` policies protect the endpoint: `auth:confirmation-request-ip` (20 per 15 minutes per client IP, taken from `Connection.RemoteIpAddress`, see [Login rate limiting behind a proxy](#login-rate-limiting-behind-a-proxy)) and `auth:confirmation-request-identifier` (3 per hour per identifier). Throttled requests are silently dropped and answered like any other.

The in-process client exposes the same operation as `IAuthClient.ResendConfirmationEmailByAddressAsync`; the login page shows a resend link with a countdown after a refused sign-in.

::: warning Limits of the enumeration protection
- **Anonymous confirmation request and forgot password:** the request does the same work for every account (limits plus one enqueue); the account lookup, the token write and the domain event happen in the mail worker, so processors of the events cannot influence the response time. A saturated queue or worker is not observable per account either.
- **Registration, default mode (`UniformResponse = false`):** `POST /api/auth/register` answers `409 Conflict` for an already confirmed address, and an unconfirmed address answers without tokens while a new one receives tokens. Anyone can still probe whether an address is registered. Enable `UniformResponse` to close this.
- **Registration, `UniformResponse = true`:** the answer, the error for a weak password and the password hash are the same for every state. Remaining timing difference: the user insert, the username search and synchronous `UserRegisteredEvent` processors only run for new accounts, because the password cannot be moved into the queue. Only the follow-up (see [Registration](11-registration.md)) runs in the worker. Processors registered by the host are not under the control of the SDK.
- **Remaining channel:** the real owner of the address may receive a confirmation mail or an "account exists" notice. A confirmed owner gets at most one notice per address and 24 hours, an unconfirmed one a mail only when the resend cooldown has elapsed. Without a shared limiter store each instance throttles on its own.
:::

## Background mail delivery

Confirmation and password-reset mails are not sent inside the request. A job is put on an in-process, bounded queue; a hosted service (`AuthMailWorker`) delivers it with a per-job timeout. Two-factor codes are still sent synchronously.

The job kinds are:

| Job | Queued by | Worker does |
|-----|-----------|-------------|
| `PasswordResetRequestJob` | anonymous `forgot-password` | per-address limit, account lookup, queues the reset mail, raises `PasswordResetRequestedEvent` |
| `ConfirmationRequestJob` | anonymous `request-confirmation-email` | account lookup, cooldown, token, raises `EmailConfirmationRequestedEvent` |
| `RegistrationFollowUpJob` | uniform registration | see [Registration](11-registration.md) |
| `PasswordResetMailJob`, `ConfirmationMailJob` | the worker or the `EmailConfirmationRequestedEvent` processor | creates the link and sends the mail |

::: warning Behavior of event processors in the anonymous flows
`PasswordResetRequestedEvent` (forgot password) and `EmailConfirmationRequestedEvent` (anonymous confirmation request, registration follow-up) are raised by the mail worker for these flows, not inside the request. Processors that the host (or another module, for example auditing) registered for these events therefore:

- run in the worker's own DI scope, **without an `HttpContext`**, without the request scope and outside the request's transaction; resolve tenant, user or IP yourself if you need them (the culture of the request is restored as `CurrentUICulture`);
- run for known accounts only, as before, but their cost no longer shows in the response time;
- can be **lost**: the queue is in memory, so an event is gone when the process is killed, and when the bounded queue is full both the event and the mail are dropped (`queue_dropped` counts it). A durable outbox is not part of this module;
- cannot stop the reset mail: for forgot password the mail is queued before the event is published, and a processor that throws is logged and counted (`send_failures`, kind `password_reset_request`). The foundation publisher stops at the first processor that throws, so processors registered after a failing one do not run for that event. For `EmailConfirmationRequestedEvent` the mail is queued by a processor of the SDK; a host processor that throws before it in registration order can prevent that mail.

Events raised for authenticated flows (resend, registration with `UniformResponse = false`) are unchanged and still run in the request.
:::

- The queue lives in memory. Mails still queued when the process is killed are lost; the user can request a new mail (resend, "forgot password").
- On a graceful stop the queue is drained for `ShutdownDrainTimeout`; the host's own shutdown timeout (30 seconds by default in .NET) also applies. Jobs left after that are discarded and logged as an error with their number.
- The host must run hosted services. A host that only builds the service provider delivers nothing.
- The culture of the request is captured when the mail is queued; the stored `PreferredCulture` of the account takes precedence.
- Each instance has its own queue; there is no coordination between instances.
- During a graceful stop the queue no longer accepts jobs. A request job that is still being drained cannot queue its follow-up mail; that mail is lost like any other queued mail.
- Metrics (meter `BieberWorks.SDK.Auth`, tag `kind`): `bieberworks.auth.email.send_failures` (delivery failed or timed out) and `bieberworks.auth.email.queue_dropped` (queue full). Both are also logged as errors, without the address. Alert on both.

See [Getting started](01-getting-started.md#mail-queue) for the settings.

## Email confirmation enforcement

Set `BieberWorks:Auth:SignIn:RequireConfirmedEmail` to `true` (default `false`) to require a confirmed email address. The gate is implemented by the Auth module itself and is not mirrored into `IdentityOptions.SignIn`.

| Flow | Behavior with the option on |
|------|-----------------------------|
| Login | After the password and the lockout check, an unconfirmed account returns `Identity.Login.EmailNotConfirmed` (HTTP 403, `DomainError.Forbidden`). No token, no 2FA code is sent, and the attempt is not counted by the login rate limiter. A wrong password still yields `Identity.Login.Unauthorized`, a locked account `Identity.Login.LockedOut`. |
| 2FA verify | Returns `Identity.Login.EmailNotConfirmed` before the code is checked. |
| Token refresh | Returns `Identity.Login.EmailNotConfirmed`; the submitted refresh token is revoked (same as for lockout). |
| Register | No tokens are issued: `TokenResponse` is `null` and `RequiresEmailConfirmation` is `true`. Without the option, registration is unchanged. |

HTTP error bodies (`ErrorResponseDto`) carry the machine-readable `code` of the first error, so API clients can branch on `Identity.Login.EmailNotConfirmed` without parsing the localized message. For the in-process client, `AuthResult.RequiresEmailConfirmation` is set when login fails with that code.

::: warning Existing users
The gate is evaluated against the current `EmailConfirmed` value, with no grandfathering. Users who registered earlier without confirming are locked out as soon as the option is switched on. Confirm or bulk-update those accounts before enabling it.
:::

::: info Claim snapshot
The cookie ticket carries an `emailConfirmed` claim captured at sign-in. It is not refreshed during the session: a user who confirms the address keeps the old value until the next sign-in.
:::

## Error codes and messages

The `message` of every error response (`ErrorResponseDto`) and every `AuthResult.Errors` entry is localized
(English and German, current UI culture) through `IErrorLocalizer`. The texts come from `AuthErrorResources`
(`Error_<code with '.' replaced by '_'>`, e.g. `Error_Identity_Login_EmailNotConfirmed`), which Auth registers via
`AddErrorResources<AuthErrorResources>()`. Operators can override single texts with SDK-Localization (module `Auth`).
The machine-readable `code` is unchanged, so clients should branch on `code`, never on `message`.

Sign-in related codes and their texts (English / German):

| Code | HTTP | English | German |
|------|------|---------|--------|
| `Identity.Login.Unauthorized` | 401 | Invalid email/username or password. | Ungültige E-Mail/Benutzername oder Passwort. |
| `Identity.Login.LockedOut` | 403 | Your account has been locked. Please try again later. | Ihr Konto wurde gesperrt. Bitte versuchen Sie es später erneut. |
| `Identity.Login.EmailNotConfirmed` | 403 | Your email address has not been confirmed yet. Please use the link in your confirmation email. | Ihre E-Mail-Adresse wurde noch nicht bestätigt. Bitte nutzen Sie den Link in Ihrer Bestätigungs-E-Mail. |
| `Identity.Login.RateLimited` | 429 | Too many sign-in attempts. Please try again later. | Zu viele Anmeldeversuche. Bitte versuchen Sie es später erneut. |
| `Identity.Login.Failure` | 400 | Sign-in failed. Please try again. | Die Anmeldung ist fehlgeschlagen. Bitte versuchen Sie es erneut. |
| `Identity.2FA.InvalidToken` | 401 | Invalid two-factor authentication code. | Ungültiger Zwei-Faktor-Code. |
| `Identity.2FA.InvalidCode` | 401 | Invalid verification code. | Ungültiger Bestätigungscode. |
| `Identity.2FA.TooManyAttempts` | 429 | Too many failed 2FA attempts. Please wait 15 minutes. | Zu viele 2FA-Fehlversuche. Bitte 15 Minuten warten. |
| `Identity.2FA.ResendThrottled` | 429 | Please wait before requesting another code. | Bitte warten Sie, bevor Sie einen neuen Code anfordern. |
| `Identity.Token.Refresh.Forbidden` | 403 | Your session can no longer be refreshed. Please sign in again. | Ihre Sitzung kann nicht mehr erneuert werden. Bitte melden Sie sich erneut an. |

`Identity.Login.Unauthorized` is deliberately neutral: it is returned for a wrong password and for an unknown user alike, so the text never reveals whether an account exists.

Every other code used by Auth (account deletion, username and display name, email confirmation, remaining 2FA codes, and the ASP.NET Core Identity password rules such as `PasswordTooShort`) has an entry in `AuthErrorResources` as well; the full list is the `.resx` file next to `AuthErrorResources.cs`. A test keeps it complete in both languages. In the login view model, texts delivered by the server are shown as they are; the UI resources `Identity.*` take precedence only for the codes they define.

## Password Flows

### Forgot password

```http
POST /api/auth/forgot-password
Content-Type: application/json

{ "email": "user@example.com" }
```

Always responds with `200 OK` (no disclosure whether the email address exists). The request only queues a `PasswordResetRequestJob` (see [Background mail delivery](#background-mail-delivery)); it does not read the account. The worker looks the address up, queues the reset mail and then raises `PasswordResetRequestedEvent` for a known address. The reset token is created and the mail sent by the worker, so neither a slow mail server nor any `IDomainEventProcessor<PasswordResetRequestedEvent>` (for example auditing) changes the response time. Those processors run in the worker without `HttpContext` (see the warning above).

The endpoint is limited per client IP (10 per 15 minutes, policy `auth:forgot-password-ip`), again only when the IP is known. A client over the limit gets the normal `200 OK`; nothing is sent. In addition the worker handles at most 3 requests per address and hour (policy `auth:password-reset-address`) and drops further ones silently. The limit is applied before the event is raised, so it also caps the volume of `PasswordResetRequestedEvent` (audit entries, host processors). Both limits use `IRateLimiter`; without the SDK-RateLimiting module the built-in in-process fallback applies, and a host without any limiter keeps working unthrottled.

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

A successful reset revokes (deletes) all refresh tokens of the user, so existing sessions cannot be refreshed any more, and ends **all** cookie sessions of the user. Already issued access tokens stay valid until they expire.

A new password that breaks the password policy returns `422` with the code `General.Validation`; `errors` lists one localized text per broken rule. Any other failure, such as an invalid or expired token or an unknown address, returns `400` with `Identity.PasswordReset.Failure`. An unknown address and an invalid token answer identically, so the endpoint does not disclose whether an account exists.

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

A successful change revokes (deletes) all refresh tokens of the user, including those of other devices, and ends all cookie sessions except the current one (`ChangePasswordRequest.KeepSessionId`, filled from the caller's `sid` claim when omitted). Already issued access tokens stay valid until they expire. See [Sessions](14-sessions.md).

## Profile Self-Service

Beyond passwords, a signed-in user can manage their own identity from the **Profile page**
(`/auth/profile` / `/account/profile`, rendered by `ProfileBase`). These actions go through
`IAuthClient` in-process — there is no public REST route for them — and each returns an
`AuthResult` so the page can surface validation errors inline.

| Action | `IAuthClient` method | Notes |
|--------|----------------------|-------|
| Change username | `ChangeUsernameAsync(userId, ChangeUsernameRequest)` | Subject to Identity username validation + uniqueness. |
| Change display name | `ChangeDisplayNameAsync(userId, ChangeDisplayNameRequest)` | Free-form display name; an empty value is stored as `null` (no fallback to the email). |
| Resend confirmation email | `ResendConfirmationEmailAsync(userId)` | Re-sends the confirmation link; also exposed as `POST /api/auth/resend-confirmation`. |

The `userId` is taken from the authenticated principal — a user can only edit their own
profile. Each successful change refreshes the corresponding field on the page; a failed
change leaves the previous value untouched and shows the error message.

> Email **address** changes are intentionally not a self-service flow here; the confirmation
> pipeline (see [Email Confirmation](#email-confirmation)) covers verifying the address set at
> registration. Admin-side user edits live under [User Management](12-roles-permissions.md#user-management-iusermanagementservice).

## Two-Factor Authentication

The module ships an **email-based one-time-code (OTP)** second factor with single-use
recovery codes. It is delivered through the same template pipeline as the other
transactional emails (template key `auth:two-factor-code`).

### Enable 2FA

```http
POST /api/auth/enable-2fa
Authorization: Bearer eyJ…
```

The request has no body; the user id is taken from the authenticated principal's claims.

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
POST /api/auth/verify-2fa
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

A new OTP can be requested via `POST /api/auth/resend-2fa`. Both limits are enforced
server-side by `IRateLimiter` with two policies: `TwoFactorVerify` (5 attempts per 15 minutes,
followed by a 15-minute lockout) and `TwoFactorResend` (1 request per 60 seconds).

> TOTP authenticator apps and WebAuthn/passkeys are intentionally out of scope for this
> email-OTP factor; they are tracked as separate follow-up work.

## Transactional emails

Auth sends its transactional mails (password reset, e-mail confirmation, two-factor code) through the generic `IEmailSender` and the email-template-descriptor pipeline. It does **not** expose a dedicated email interface on its contract surface — an internal adapter bridges to `IEmailSender` and renders the bodies by template key.

### Locale-aware sending — PreferredCulture

Each transactional mail (password reset, e-mail confirmation, two-factor code) is rendered
in the recipient's persisted `PreferredCulture` when one is set on the user record. The
internal `IAuthEmailSender` methods accept an optional `locale` parameter that the three
domain-event handlers (`PasswordResetRequestedEventHandler`,
`EmailConfirmationRequestedEventHandler`, `TwoFactorCodeRequestedEventHandler`) populate
from `ApplicationUser.PreferredCulture` before calling the sender:

```csharp
await emailSender.SendEmailConfirmationAsync(
    domainEvent.Email, customerName, confirmationLink, user?.PreferredCulture);
```

The language of a mail is resolved in this order:

1. The explicit locale passed to the sender (the persisted `PreferredCulture`).
2. The culture of the current request or circuit (`CultureInfo.CurrentUICulture`, set by request localization from the culture cookie or `Accept-Language`). An API host must call `UseBieberWorksLocalization()` for this to be the caller's language.
3. English, the base template. The invariant culture counts as "no value".

The adapter applies this once for subject and body of all three mail kinds. `PreferredCulture` is written at registration: the explicit `RegisterRequest.Culture` (validated, at most 35 characters, invalid values are ignored), otherwise the ambient culture. `HttpAuthClient` sends its `CurrentUICulture` automatically, because a remote API cannot see the app culture. Resending the confirmation mail, or registering again with an unconfirmed address, never overwrites a stored `PreferredCulture`; the mail then follows the stored value or the ambient culture.

The greeting uses `FirstName LastName`, then the display name, then nothing ("Hello,"). The mail address is never used as a name: a display name that equals the address, its local part (for example `max.mustermann` for `max.mustermann@example.de`, compared case-insensitively) or the stored user name is treated as empty. Registration stores the sanitized local part as both user name and display name, so this check covers that value; a display name chosen by the user is kept.

### Delivery failures

A failed delivery never changes the response of the endpoint that triggered it: registration, resend, forgot-password and sign-in answer the same as on success, and `forgot-password` answers identically for known and unknown addresses (also through `InProcAuthClient`). The handlers log the failure at `Error` level with the exception and the user id (never the address) and increment the counter `bieberworks.auth.email.send_failures` (tag `kind`: `email_confirmation`, `password_reset`, `two_factor_code`, `password_reset_request`, `confirmation_request`) of the meter `BieberWorks.SDK.Auth`. The meter uses only `System.Diagnostics.Metrics`; add it to OpenTelemetry with `AddMeter("BieberWorks.SDK.Auth")` and alert on the counter. Users whose mail did not arrive can request a new one from the login page or through the anonymous resend endpoint.

- If `SDK-Email` is installed and an `IEmailSender` is registered, the bodies are rendered through `SDK-Email`'s template pipeline (keyed by `AuthEmailTemplateKeys`) and sent via `IEmailSender`.
- If no `IEmailSender` is registered, the module falls back to logging the links only (suitable for development).

::: tip Customizing auth emails
Override the Auth email **templates**, not the sending code. Each transactional mail is registered as an `IEmailTemplateDescriptor` keyed by `AuthEmailTemplateKeys` (see the next section) and can be edited per locale in the Email admin UI without touching code.
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
