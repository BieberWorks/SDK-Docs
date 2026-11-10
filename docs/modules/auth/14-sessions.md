# Server-Side Cookie Sessions

Every cookie sign-in is backed by a row in `auth.UserSessions`. The cookie stays self-contained (a protected ticket) but now carries a session id (`sid` claim), and the row decides whether the cookie is still good. This makes the following possible, which a plain signed cookie cannot do:

- **Sign-out really ends the session.** A copied cookie stops working.
- **Locking a user, changing or resetting the password and changing two-factor settings end sessions.**
- **Roles are live.** A role change is picked up without a new sign-in.
- **Absolute lifetime and idle timeout** are enforced on the server.
- **Open Blazor circuits are revalidated**, so an ended session also ends an already open tab.

JWT access tokens and refresh tokens are not part of this mechanism. Requests with an `Authorization: Bearer` header bypass the cookie handler and are not checked against sessions.

::: warning Action required when upgrading
Cookies issued before this feature carry no `sid` claim and are rejected (and deleted) once. **Every signed-in user has to sign in again one time.** There is no compatibility mode, because a legacy cookie is exactly the non-revocable state this feature closes.

In a deployment with a decoupled web host (see below) upgrade the **Api first**, then the web host. A new web host in front of an old Api rejects every cookie.
:::

## Concepts

| Term | Meaning |
|---|---|
| Absolute lifetime | Hard end of a session (default 7 days). The cookie's ticket expires at the same moment, so it is enforced even when the session store cannot be reached. The cookie is not sliding any more. |
| Idle timeout | A session without real activity for this long ends (default 8 hours). Tracked in `LastSeenAt`, server side only. |
| Activity | A request that arrives with a valid cookie, and real input (pointer, keyboard) in an open Blazor circuit. **The background revalidation of a circuit is never activity**, otherwise an unattended tab would stay alive forever. |
| Ended | A session is ended by sign-out, security events, eviction (cap) or by time. Ended is final: unlocking a user does not bring a session back. |

`AuthCookieOptions.ExpireTimeSpan` is no longer the session lifetime; it only remains as the fallback for tickets issued without an expiry. Sessions use `AuthSessionOptions` below.

## What ends a session

| Event | Effect |
|---|---|
| Sign-out (`GET /api/auth/signout`) | The current session. Works with an expired cookie too (the signature of the cookie is enough). Ignored for `Sec-Fetch-Site: cross-site`. |
| Change password | All sessions **except the current one**. |
| Reset password (anonymous) | All sessions. |
| Lock user (`SetUserLockedAsync(.., true)`) | All sessions. The validator also rejects a locked user with `UserLocked` whatever the cause of the lock. |
| Enable or disable two-factor | All sessions except the current one. |
| Delete user / GDPR erasure | The rows are removed by cascade. |
| More than `MaxActiveSessionsPerUser` | The oldest sessions end with reason `Evicted`. |
| Role change | **Nothing ends.** The new roles are delivered by the validator and replace the cookie's role claims on the next validation (cache window, see below). |

The user-to-role assignment is read fresh from the database on every validation (after the cache window below), including direct database changes. The permissions of a role are a different matter: `PermissionService` caches the effective permissions for up to 5 minutes, and only `RoleManagementService` invalidates that cache immediately. Direct database changes to role permissions therefore take effect only after the cache expires. The cache lives in the process of each host, so `Invalidate()` on the Api does not reach a decoupled web host; there the change becomes visible after the cache TTL at the latest.

Each revocation publishes an audit event (`UserSessionRevokedEvent` for one session, `UserSessionsRevokedEvent` with `Count > 0` for several), both `IAuditableEvent` with the user id as resource id.

The "current session" is taken from the `sid` claim of the caller. `ChangePasswordRequest` has an optional `KeepSessionId`; the in-process `IAuthClient` fills it from the circuit's or request's principal when it is not given, and REST callers use the claim of their cookie. A Bearer caller has no session, so all cookie sessions end.

## Options

Section `BieberWorks:Auth:Sessions` (class `AuthSessionOptions`), validated at startup:

| Property | Default | Description |
|---|---|---|
| `IdleTimeout` | 8 h | Inactivity until a session ends. Must not exceed `AbsoluteLifetime`. |
| `AbsoluteLifetime` | 7 d | Hard maximum, also the cookie ticket expiry. |
| `TouchInterval` | 5 min | At most one write of `LastSeenAt` per session in this period. Must be shorter than `IdleTimeout`. |
| `MaxActiveSessionsPerUser` | 20 | Cap; the oldest sessions are evicted. |
| `ClientInfo` | `UserAgent` | `None`, `UserAgent`, or `UserAgentAndTruncatedIp` (IPv4 /24, IPv6 /48). |
| `RetentionAfterEnd` | 30 d | Ended sessions are deleted after this. Active sessions are never deleted. |
| `CleanupInterval` | 1 h | Interval of the cleanup service (batched, safe with several instances). |
| `CleanupBatchSize` | 1000 | Rows per delete statement. |
| `LegacyPlainTokenGrace` | 1 day | Time after process start from which the cleanup re-writes leftover plain-text refresh tokens (from instances that predate hashing) as hashes. Set it longer than a rolling deploy. |
| `EnableInternalValidationEndpoint` | `false` | Maps the internal endpoint for decoupled web hosts. |
| `InternalPathPrefix` | `/_internal/auth` | Path prefix of that endpoint. |

Section `BieberWorks:Auth:Sessions:Client` (class `AuthSessionClientOptions`) controls validation and caching in every host that checks cookies:

| Property | Default | Description |
|---|---|---|
| `CacheDuration` | 30 s | Reuse of an `Active` result. `0` disables caching (every check reads the source). |
| `NegativeRetention` | 10 min | Reuse of a final negative result (revoked, expired, idle, unknown). |
| `UnavailablePolicy` | `Closed` (`StaleThenClosed` for the reader, see below) | What to do when the source cannot be reached. |
| `MaxStale` | 5 min | Longest reuse of a stale `Active` result for `StaleThenClosed`. |
| `FailureBackoff` | 5 s | Pause before the source is asked again after a failure. |
| `CircuitRevalidationInterval` | 30 s | Interval of the circuit revalidation. |
| `ActivityReportInterval` | 1 min | Minimum pause between two activity reports of a session. |
| `ListenerThrottle` | 30 s | Throttle of the browser activity listener. |
| `CookieScheme` | `Cookies` | Cookie scheme the check is attached to. |
| `BackendInternalUri` | (none) | Reader only: base address of the backend (see below). |
| `InternalPathPrefix` | `/_internal/auth` | Reader only: must match the backend. |
| `RemoteTimeout` | 2 s | Reader only: timeout of one validation call. |

::: warning Short idle timeouts need a smaller TouchInterval
`TouchInterval` must be shorter than `IdleTimeout`, otherwise startup fails with an `OptionsValidationException`. The default `TouchInterval` is 5 minutes, so every `IdleTimeout` of 5 minutes or less (for example for testing) requires a smaller `TouchInterval` too:

```json
{ "BieberWorks": { "Auth": { "Sessions": { "IdleTimeout": "00:03:00", "TouchInterval": "00:00:30" } } } }
```

Keep `TouchInterval` at about one third of `IdleTimeout` at most, because `LastSeenAt` is written only that often.
:::

::: warning TimeSpan values must not be empty
An empty value (for example from `${IDLE_TIMEOUT:-}` in Compose) throws a `FormatException` at startup. Omit the key to use the default.
:::

## Revocation latency and caching

The validator caches `Active` results for `CacheDuration`. A revocation executed on the same instance evicts the cache entry at once. On another instance, and in a decoupled web host, it becomes visible after at most `CacheDuration`; in an open Blazor tab add up to one `CircuitRevalidationInterval`. With the defaults that is roughly 30 to 60 seconds. There is no cross-instance invalidation; `SessionValidationCache.Evict` and `EvictUser` are the single seam a future backplane would call. Set `CacheDuration` to `0` for hosts that need immediate effect at the price of one database read per check.

Concurrent checks of one session share a single source call.

## Failure policy

An unreachable session source is **not** a revoked session. In that case the request is treated as anonymous, but the cookie is kept (no sign-out), so a database blip never signs everybody out.

| Policy | Behaviour | Default for |
|---|---|---|
| `Closed` | Anonymous while the source is unreachable. | Hosts with a local database (monolith, API host). |
| `StaleThenClosed` | The last known `Active` result is reused up to `MaxStale` (5 min), then closed. A session never validated before is closed. | Decoupled web host (reader). |
| `Open` | The cookie is accepted without validation (roles from the cookie). Revocation is not enforced. Not recommended. A session known to be ended stays rejected. | Option only. |

Because the cookie ticket carries the absolute expiry, the maximum lifetime is enforced under every policy.

## Host types

### Monolith or API host (the module owns the database)

`AddBieberWorksAuth` registers everything: the table (migration `AddUserSessions` is applied by the module initializer), the database source, the cached validator, the cookie hook and the cleanup service. Login (`finalize-login`) starts the session; `signout` ends it. Nothing else is required.

With `AddAuthUi()` the Blazor circuit is covered as well:

- The circuit's `AuthenticationStateProvider` is replaced by `BwSessionAuthenticationStateProvider`. It revalidates every `CircuitRevalidationInterval` through the same cached validator as the HTTP pipeline. When the session ended, the state turns anonymous and the existing `BwAuthorizeRouteView` redirects to the login page (full page load, so the cookie is dropped by the HTTP pipeline). Changed roles replace the principal in place.
- The `UserMenu` app-bar widget renders the invisible `BwSessionActivityListener`, which reports real input (pointer down, key down) with a throttle. Hosts that do not render the user menu add `<BwSessionActivityListener />` once in an interactive layout or in `Routes.razor`.
- As long as a circuit has never received a report from the listener, the circuit's inbound traffic counts as activity instead, so users of hosts without the listener are not signed out while working. Keepalive pings and the revalidation do not count.

The provider registration uses `RemoveAll` plus `AddScoped`, so it does not depend on the order relative to `AddInteractiveServerComponents`. A host without a registered `ISessionValidator` keeps the framework provider.

### Decoupled web host (cookie readable, no database)

A web host that shares the data-protection key ring with the Api can read the cookie but has no database. It validates sessions through the Api's internal endpoint.

**Api:**

```json
{ "BieberWorks": { "Auth": { "Sessions": { "EnableInternalValidationEndpoint": true } } } }
```

**Web host** (package `BieberWorks.SDK.Auth.Session`, no Auth module needed):

```csharp
builder.Services
    .AddAuthentication("Cookies")
    .AddCookie("Cookies", o => o.Cookie.Name = "bw.auth");   // same name and key ring as the Api

builder.Services.AddBieberWorksAuthSessionReader(builder.Configuration);
```

```json
{ "BieberWorks": { "Auth": { "Sessions": { "Client": {
    "BackendInternalUri": "http://my-stack-api:8080"
} } } } }
```

Place `<BwSessionActivityListener />` once in an interactive layout so the web host reports real activity (it reaches the Api through the same endpoint, flag `active`).

How it works:

- `POST {InternalPathPrefix}/sessions/validate` with `{ "sessionId", "userId", "active" }`. Every functional status answers HTTP 200 with `{ "status", "roles" }`, including `Revoked`. A session is never reported active for a different user id.
- The caller proves itself with the header `X-BW-Session-Auth`, a time-limited (60 s) data-protection token created with the shared key ring. No new secret exists; whoever owns the ring can forge cookies anyway. Without the endpoint enabled, the route does not exist (404).
- The client treats timeouts, network errors, 5xx, 404 and **401 as unavailable, never as revoked**. A 401 is logged as an error because it means a misconfiguration: key ring not shared, endpoint disabled, or the wrong service addressed.
- Any other non-success status (including **400**) is treated as unavailable too, logged as a warning ("answered 400; treating the session as unavailable"). It is never treated as revoked.
- If the Api uses host filtering (`AllowedHosts`), the internal alias from `BackendInternalUri` must be listed there. Otherwise the Api rejects the web host's call with 400 and the client sees the session source as unavailable (policy `StaleThenClosed`, then anonymous).
- `UnavailablePolicy` defaults to `StaleThenClosed` for the reader.
- `AddBieberWorksAuthSessionReader` fails at startup when `BackendInternalUri` is not an absolute http(s) URI.

::: danger Do not point BackendInternalUri at a shared network alias
`BackendInternalUri` is plain configuration and is never derived from public URLs. In a Docker Compose setup, do **not** use a service name such as `http://api:8080` when several stacks (staging, live) share a network: the name `api` can resolve to the Api container of another stack and cause 401 responses or wrong answers. Give the Api a stack-unique alias on the private `backend` network (for example `${STACK_NAME}-api`) and use that alias:

```yaml
services:
  api:
    networks:
      backend:
        aliases:
          - ${STACK_NAME}-api
```

Also make sure the reverse proxy does not route `/_internal` to the Api. The token is the security boundary; the routing is only a second layer.
:::

## Multi-instance notes

- The cache is per instance (see above). Sessions themselves are shared through the database.
- The one-time sign-in ticket store (`finalize-login`) is still process-local, as before: the login redirect must reach the instance that created the ticket.
- Cleanup is idempotent, so running it on several instances is safe.

## Data model and privacy

Table `auth.UserSessions`: `Id` (random v4 GUID), `UserId` (FK to the user, `ON DELETE CASCADE`), `CreatedAt`, `LastSeenAt`, `ExpiresAt`, `RevokedAt`, `RevokedReason`, `UserAgent` (max 256 chars), `IpAddress` (max 45 chars). Indexes: active sessions per user (partial, `RevokedAt IS NULL`), `ExpiresAt`, and ended sessions (partial, `RevokedAt IS NOT NULL`) for the cleanup.

- By default only the shortened **user agent** is stored. The IP address is personal data and is stored only with `ClientInfo = UserAgentAndTruncatedIp`, truncated (IPv4 /24, IPv6 /48), taken from the connection address (configure forwarded headers in the host, never read a raw `X-Forwarded-For`).
- Ended sessions are deleted after `RetentionAfterEnd`.
- Deleting a user (including every GDPR erasure mode) removes all of the user's sessions by cascade.

## Sign-out

`GET /api/auth/signout` ends the session identified by the cookie, deletes the cookie and redirects to `/auth/login`.

- A request with `Sec-Fetch-Site: cross-site` is ignored (redirect only, nothing is ended or deleted). `same-origin`, `same-site`, `none` and a missing header (non-browser clients) proceed. This matters for hosts that run the cookie with `SameSite=Lax`.
- The cookie is read directly, so an already expired cookie still ends its session. A forged or missing cookie ends nothing and does not fail.
- The response is `Cache-Control: no-store`.
- Moving sign-out to POST with antiforgery is a planned follow-up (it needs a form instead of a navigation in the logout page).

## Access token lifetime

Access tokens cannot be revoked. After a revocation a Bearer client keeps working until its access token expires. Keep `JwtSettings:AccessTokenExpirationMinutes` at 15 or lower where this matters; the code does not enforce a default.

## Consumer checklist

1. Release notes: one-time forced sign-in ("Action required").
2. Decoupled web host: Api first, then the web host; share the data-protection key ring; set `BackendInternalUri` to a stack-unique alias; enable the endpoint on the Api; if the Api sets `AllowedHosts`, include that alias there (otherwise HTTP 400, treated as unavailable).
3. Tests that build cookies by hand must include a valid `sid` claim of a real session.
4. Render `<BwSessionActivityListener />` in hosts that do not use the Auth user menu.
