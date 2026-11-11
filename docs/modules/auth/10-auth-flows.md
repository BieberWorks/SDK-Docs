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

The 2FA challenge token (issued after the password step, before the second factor) is signed for its own audience (`<Audience>:2fa-challenge`) and carries a `purpose` claim. Bearer validation rejects it, so it can only be redeemed at the 2FA verify step and never authenticates a protected route.

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

Unknown accounts and wrong passwords return the same `401` response. To keep the response time comparable, a sign-in for an unknown account verifies the password against a constant dummy hash created once per process with the active password hasher (same algorithm and cost) and then reused, so an unknown account costs exactly one verification, like a wrong password; the result is discarded.

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

The same applies to the service-token endpoint (`POST /auth/service-token`): attempts are counted per (remote address, client id), and unknown client ids share one per-address bucket. Behind a proxy without trusted forwarded headers every caller has the proxy address, so anyone who knows a (non-secret) client id can lock that service out for the lockout period, and a lockout also rejects the correct secret. Mitigations: configure `UseForwardedHeaders` with `KnownProxies`/`KnownIPNetworks`, and keep the token endpoint reachable only from the internal network.

At startup the module logs a warning when forwarded-header processing for `X-Forwarded-For` does not appear to be configured. This check is best effort: it cannot detect the real network topology, never aborts startup, and can be ignored for hosts that are exposed directly.

### Sign-in and 2FA attempt limits

Login, 2FA verify and 2FA resend (policies `WellKnownRateLimitPolicies.Login`, `.TwoFactorVerify`, `.TwoFactorResend`) take a slot from `IRateLimiter.TryAcquireAsync` **before** the password, code or resend is processed (acquire first). A successful sign-in (correct password, account not locked, confirmation gate passed) resets the login counter; a successful 2FA verification resets the verify counter, for an OTP and for a recovery code alike. Parallel attempts therefore cannot multiply the budget: with the default 5 attempts, a burst of 40 wrong passwords checks at most 5 passwords and answers the rest with `429`.

Defaults (hosts can override every policy): sign-in 5 attempts per 15 minutes per (client address, identifier), without a separate lockout, so the wait ends with the window; 2FA verify 5 attempts per 15 minutes per user, then a 15-minute lockout; 2FA resend 1 per 60 seconds per user.

Consequences:

- Every attempt counts, including attempts for unknown accounts, for locked accounts and for unconfirmed accounts (fail-closed). Only a full success gives the budget back.
- A rejected attempt carries the wait time in `DomainError.RetryAfter` (`Identity.Login.RateLimited`, `Identity.2FA.TooManyAttempts`, `Identity.2FA.ResendThrottled`). The HTTP endpoints (`login`, `verify-2fa`, `resend-2fa`) answer `429` with a `Retry-After` header in whole seconds (rounded up, at least 1). Every Auth endpoint error that carries `DomainError.RetryAfter` gets this header.
- `resend-2fa` reports `cooldownSeconds` from the window of the registered resend policy (default 60), so an overridden policy is reflected in the countdown.
- `IRateLimiter.PeekAsync` is not used as a gate any more; it remains a read-only hint for display purposes (and for the delay of the sign-in brake below, which is a delay stage, not a gate).

### Sign-in brake per client address (opt-in)

The per-(address, identifier) limit does not stop password spraying: one address trying one password against many accounts hits a new partition every time. The optional sign-in brake counts **failed** sign-ins (unknown account or wrong password) per client address across all accounts and slows that address down. It is **off by default**.

```json
{
  "BieberWorks": {
    "Auth": {
      "SignIn": {
        "FailureBrake": {
          "Enabled": true,
          "DelayAfterFailures": 10,
          "DelayStep": "00:00:00.500",
          "MaxDelay": "00:00:05",
          "MaxConcurrentPerAddress": 16,
          "MaxConcurrentPerBrakedAddress": 2,
          "MaxHeldRequests": 256,
          "RejectWhenSaturated": false
        }
      }
    }
  }
}
```

| Setting | Default | Meaning |
|---|---|---|
| `Enabled` | `false` | Main switch. |
| `DelayAfterFailures` | `10` | Failures per address and window without a delay. |
| `DelayStep` | 500 ms | Delay added per failure above `DelayAfterFailures`. |
| `MaxDelay` | 5 s | Upper bound of the delay (at most 30 s). |
| `MaxConcurrentPerAddress` | `16` | Sign-in checks of one address that may run at the same time while the address is not delayed. Caps a burst that arrives before the first failures are counted. Further parallel sign-ins get `429` with `Retry-After` (at least 1 s). |
| `MaxConcurrentPerBrakedAddress` | `2` | Sign-in checks of one address that may run at the same time while the address is delayed (must not exceed `MaxConcurrentPerAddress`). Further parallel sign-ins get `429` with `Retry-After` (the current delay, at least 1 s). |
| `MaxHeldRequests` | `256` | Sign-ins that may wait in a delay at the same time in this process; above it a delayed sign-in gets `429` with a short `Retry-After`. Addresses without a delay are never rejected because of it. |
| `RejectWhenSaturated` | `false` | When `true`, an address that reached the policy's permit limit gets `429` until the window ends instead of the maximum delay. Users behind the same NAT are rejected as well. |

Invalid values fail the start (`ValidateOnStart`).

Behaviour:

- Failures are counted in the rate-limit policy `auth:login-ip` (default 30 per 15 minutes, no lockout), partitioned by the client address: IPv4, or the /64 prefix for IPv6. Override it like every other policy (`ratelimit:auth:login-ip:limit` / `:window-seconds` with SDK-RateLimiting and SDK-Settings). The permit limit is the saturation point; the brake never locks out. A lockout configured through an override is treated as saturation.
- The delay is applied **before** the account lookup and the password check, so it depends on the address only: known and unknown accounts, successes and failures take equally long.
- A successful sign-in neither counts nor resets the counter (otherwise an attacker could clear it with an own account). Locked accounts, unconfirmed accounts, rejections by the per-account limit and cancelled requests are not counted. The counter expires with the window; after the window an address starts with a fresh allowance.
- Without a known client address (for example a sign-in inside an interactive Blazor Server circuit without `HttpContext`) the brake does not apply. There is no shared "unknown" bucket.
- Parallel sign-ins of one address are capped while the brake is enabled, also while the address is still "cold" (below `DelayAfterFailures`). A slot is taken before the delay and held until the password check has finished; it is returned on every outcome, including errors and cancelled requests. Without the cap a parallel client would not be slowed down by a delay at all, and a burst could pass before a single failure is counted. With the defaults a delayed address gets about 24 checks per minute.
- The concurrency bookkeeping exists only for addresses with a running sign-in and is removed when the last one finishes. A defensive bound (10 x `MaxHeldRequests` tracked addresses) rejects only new, delayed addresses; addresses without a delay are never rejected because of other addresses.
- Rejections use the existing code `Identity.Login.RateLimited` with `Retry-After`; delayed `401` responses carry no `Retry-After`.
- Counters are per process; with several instances each has its own budget.

Enable it only when the host sees the real client address (see "Login rate limiting behind a proxy" above). Behind a proxy whose forwarded headers are not trusted, every user has the proxy address and all sign-ins are slowed down together. Clients and proxies in front of Auth should not retry `POST` sign-in requests automatically.

#### Honest limits of the brake

The brake slows down password spraying from a single address. It is not a complete defence:

- **Distributed botnets.** Many addresses with few attempts each stay below the per-address thresholds. The brake does not help here. Use a per-account counter across addresses, a CAPTCHA or proof-of-work step, or a WAF in front of the host.
- **IPv6 rotation.** Addresses are grouped by /64. A client with a /56 or /48 prefix owns 256 or 65,536 /64 networks, and each starts with a full allowance, so the brake is weaker by that factor for such clients. There is no /48 stage.
- **Window-end cliff.** The counter uses the fixed window of the policy (15 minutes by default). When it expires the address starts again with `DelayAfterFailures` undelayed attempts. With the defaults that is at most 10 fast attempts per address and 15 minutes.
- **Per-instance counters.** Counters and the concurrency caps live in process memory. With N instances an address gets up to N times the budget.
- **Shared addresses.** Users behind the same NAT share the delay while an attack from that address is running. The delay is capped by `MaxDelay` and never turns into a lockout unless `RejectWhenSaturated` is on.

At startup the module also logs a warning when the brake is enabled and `KnownProxies`/`KnownIPNetworks` hold no address beyond the loopback defaults, because then `X-Forwarded-For` of a proxy is ignored. Like the other forwarded-header check this never aborts the start.

See [Enable the sign-in brake](01-getting-started.md#enable-the-sign-in-brake) for the activation checklist and [Upgrading](01-getting-started.md#sign-in-brake-in-the-next-minor-release) for the version note.

### Account lockout

A locked-out account (ASP.NET Core Identity lockout, set by an administrator or by Identity itself) is rejected consistently:

| Flow | Behavior |
|------|----------|
| Login (`LoginCommandHandler`) | After the password has been verified, a locked account returns `Identity.Login.LockedOut` (HTTP 403, `DomainError.Forbidden`). No token and no 2FA code is issued. The attempt slot taken before the password check stays consumed (see [Sign-in and 2FA attempt limits](#sign-in-and-2fa-attempt-limits)). |
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

**Storage and reuse detection.** Refresh tokens are stored only as a SHA-256 hash (`h1:` + Base64); the plain value exists only in the response to the client, so a leaked database cannot be replayed. Every login starts a token *family*; each refresh keeps the family and marks the old token as replaced. Presenting a replaced token again is treated as theft: the whole family is revoked and the request answers `Identity.Token.Refresh.Forbidden` (403), so both the thief and the legitimate client must sign in again. A second use within `JwtSettings:RefreshTokenReuseGraceSeconds` (default 10) of the rotation, as caused by two parallel requests of one client, is only rejected and does not revoke the family. Parallel redemption is decided by an optimistic-concurrency check: exactly one request wins. Replaced tokens are kept until their own expiry, which is the refresh-token lifetime, so reuse can still be detected late (for example by a device that was offline). A background job removes expired rows of inactive users as well.

**Upgrade.** The migration `HashRefreshTokensAddFamily` adds `FamilyId`, `ReplacedAt` and `Version` to `auth."RefreshTokens"`, gives every existing token its own family and replaces the stored plain value by its hash, so sessions survive a **stop-the-world** upgrade (all old instances stopped before the new version starts). It rewrites the table once and builds two indexes while holding a lock on it; see [Upgrading](01-getting-started.md#upgrading) for the rolling-deploy behaviour and the recommended order. The conversion is idempotent (converted rows carry the `h1:` prefix). Rolling back (`Down`) drops the new columns and deletes the hashed tokens: users must sign in again.

Plain tokens that an older instance writes after the migration are still redeemed by the new version: it looks the value up as a hash and, for rows without the `h1:` prefix, as the plain value, then rewrites the row as a hash in its own family. The reverse does not work: an old instance cannot read hashed tokens and answers 403 for them.

### Token sign-out

```http
POST /api/auth/logout
{ "refreshToken": "base64…" }
```

**Opt-in:** the route answers `404` unless the host sets `BieberWorks:Auth:TokenLogout:Enabled=true`. Hosts that do not serve a token client such as the BFF expose no additional anonymous route. The 256-bit random refresh token in the body is the credential (like on `POST /api/auth/refresh`); no other secret is needed to revoke it.

Revokes the login chain (token family) of the presented refresh token, so a token client (for example the [BFF](17-bff.md)) can end its session for real. Sending an older, already rotated token (for example after a lost response) ends the current chain as well; other devices keep their sessions. Anonymous, idempotent and limited to 60 calls per minute per client address (`429` with `Retry-After`). Unknown, expired or already revoked tokens answer `200` too, so the call reveals nothing about which tokens exist (a revoke that cannot be stored answers an error instead). Access tokens already issued stay valid until they expire.

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

### Durable mail queue

The in-memory queue loses queued mails when the process is killed. For hosts that must not lose them (for example the identity service of a split deployment) set `BieberWorks:Auth:MailQueue:Durable` to `true`. Nothing else changes for the callers: the flows return as fast as before, and without the setting the in-memory queue is registered exactly as before.

- Jobs are rows of `auth."MailJobs"` (added by the migration `AddMailJobs`; it is applied with the other Auth migrations, also when the option is off). `DurableAuthMailWorker` claims due rows with `FOR UPDATE SKIP LOCKED` and a lease, delivers them, and marks them delivered. A killed process leaves the lease to expire; the job is then claimed again, by this or by another host.
- The confirmation mail job is written by the very `SaveChanges` that stores the confirmation token (`EmailConfirmationTokenService`). A crash can therefore neither leave a token without its mail intent nor a mail intent without its token, and a failed commit leaves no job. Anonymous requests (forgot password, confirmation request, uniform registration) store their job in one insert before the answer is given.
- `EmailConfirmationRequestedEventHandler` still runs, but recognises the job by its duplicate key (user and a hash of the token) and does nothing. Events raised by other code without a stored job still produce one.
- A failing send is no longer swallowed: the job is retried with exponential backoff and parked as dead after `MaxAttempts` (the row stays for inspection, `LastError` holds the reason). Delivered rows lose their payload (it contains the token) and are purged after `RetentionPeriod`.
- Delivery is at-least-once towards the configured `IEmailSender`. While a durable job is delivered, `AuthMailIdempotency.Current` holds the job id. A sender that stores the mail itself, for example into an outbox, should use it as the identity of that record; then a crash between "stored" and "marked delivered" cannot produce a second mail. The identity service of the ServiceKit pilot does exactly that.

Limits: two commits remain in the register flow (user, then token), so a crash between them leaves an account without a mail, as before; the user can request a new one. In the anonymous resend flows the token and the follow-up job are also separate steps of the worker. A job stays in the database for at most `RetentionPeriod` after delivery; payloads of pending jobs and of dead jobs younger than `DeadPayloadRetention` (default 7 days) contain the confirmation token like the token table does, so protect the table like `EmailConfirmationTokens`.

### Health check for dead mail jobs

With `Durable` enabled, Auth registers a standard `IHealthCheck` named `auth-mail-jobs` (tag `ready`). It counts jobs that were parked as dead within `DeadJobHealthWindow` (default 24 hours) and reports `Degraded` (never `Unhealthy`) once the count reaches `DeadJobHealthThreshold` (default 1); otherwise `Healthy`. The description contains only counts, no addresses or payloads. If the database cannot be queried, the result uses the registration's `FailureStatus` (`Degraded`) and the error is logged. Expose it by mapping health checks in the host (for example `MapHealthChecks("/health/ready", new() { Predicate = r => r.Tags.Contains("ready") })`).

::: warning Behavior of event processors in the anonymous flows
`PasswordResetRequestedEvent` (forgot password) and `EmailConfirmationRequestedEvent` (anonymous confirmation request, registration follow-up) are raised by the mail worker for these flows, not inside the request. Processors that the host (or another module, for example auditing) registered for these events therefore:

- run in the worker's own DI scope, **without an `HttpContext`**, without the request scope and outside the request's transaction; resolve tenant, user or IP yourself if you need them (the culture of the request is restored as `CurrentUICulture`);
- run for known accounts only, as before, but their cost no longer shows in the response time;
- can be **lost** with the default in-memory queue: an event is gone when the process is killed, and when the bounded queue is full both the event and the mail are dropped (`queue_dropped` counts it). The [durable mail queue](#durable-mail-queue) keeps the mail, not the event;
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
| Login | After the password and the lockout check, an unconfirmed account returns `Identity.Login.EmailNotConfirmed` (HTTP 403, `DomainError.Forbidden`). No token, no 2FA code is sent, and the attempt slot taken before the password check stays consumed. A wrong password still yields `Identity.Login.Unauthorized`, a locked account `Identity.Login.LockedOut`. |
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
| `Identity.2FA.ReauthRequired` | 403 | Please confirm with your password or a 2FA code. | Bitte bestätige mit deinem Passwort oder einem 2FA-Code. |
| `Identity.2FA.ReauthFailed` | 403 | The password or code is incorrect. | Das Passwort oder der Code ist falsch. |
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

### Disable 2FA and regenerate recovery codes

```http
POST /api/auth/disable-2fa
POST /api/auth/regenerate-recovery-codes
Authorization: Bearer eyJ…
Content-Type: application/json

{ "verification": "<password, unused recovery code or current 2FA code>" }
```

Both routes require re-authentication, so a stolen access token alone cannot remove the second factor. A missing proof answers `Identity.2FA.ReauthRequired` (403), a wrong one `Identity.2FA.ReauthFailed` (403). Every attempt takes a slot of its own budget (policy `auth:2fa-reauth`, 5 per 15 minutes, then `Identity.2FA.TooManyAttempts`, 429) before the proof is checked, and a valid proof resets it. The budget is separate from the 2FA sign-in counter, so someone with only a stolen access token can block further re-authentication but cannot lock the account owner out of signing in. The password is compared exactly as typed; recovery and e-mail codes are trimmed. The default limiter keeps counters per process: with several instances the budget applies per instance unless a shared limiter store is configured. `IAuthClient` gained overloads `DisableTwoFactorAsync(userId, verification, ct)` and `RegenerateRecoveryCodesAsync(userId, verification, ct)` (default interface methods, so existing implementers keep compiling); the old overloads without proof are rejected by this server. The commands `DisableTwoFactorAuthCommand` and `RegenerateRecoveryCodesCommand` carry the proof in the init property `Verification`; the Security page asks for it.

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

### Address limits are partitioned by hash

Rate limits keyed by an e-mail address or identifier (login, forgot password, account-exists notice, confirmation request) never hand the raw address to `IRateLimiter`. The value is normalised (trimmed, lower-cased) and passed as a SHA-256 hex digest, so the limiter store, its logs and any future shared backend contain no addresses. Casing variants of one address still share a bucket; the login limit stays keyed by client IP plus the address hash, and the lockout reset after a successful login uses the same key.
