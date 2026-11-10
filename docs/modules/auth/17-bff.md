# BFF for Blazor Server (Auth.Bff)

A Blazor Server frontend that talks to a separate identity service should never hand tokens to the browser. `Auth.Bff` is the reusable backend-for-frontend for that: the browser holds one opaque, `HttpOnly` session cookie, the access and refresh tokens stay on the frontend server, and every outgoing call gets the signed-in user's token attached.

It works against any identity service that offers `POST api/auth/login`, `api/auth/refresh` and `api/auth/logout` (the Auth module's REST API does). It has no UI and no MudBlazor dependency.

**Identity side:** enable the sign-out route of the Auth module with `BieberWorks:Auth:TokenLogout:Enabled=true` (it is off by default). Without it the BFF still signs the user out locally, but the refresh token is not revoked at identity (logged).

## Packages

| Package | Contents |
|---|---|
| `BieberWorks.SDK.Auth.Bff` | Session cookie scheme, session manager (refresh, limits, logout), `MapBff` endpoints, circuit token hook, in-memory and distributed-cache stores, REST identity client |
| `BieberWorks.SDK.Auth.Bff.Postgres` | PostgreSQL session store and an optional Data Protection key ring in the same database |

## Add it to a host in 10 lines

```csharp
// Program.cs (Blazor Server host)
using BieberWorks.SDK.Auth.Bff;
using BieberWorks.SDK.Auth.Bff.Postgres;

builder.Services.AddBieberWorksBff(builder.Configuration, o => o.IdentityBaseAddress = new Uri("http://identity:8080"))
    .UsePostgres(o => o.ConnectionString = builder.Configuration.GetConnectionString("BffDb")!);
builder.Services.AddRazorComponents().AddInteractiveServerComponents();
builder.Services.AddAuthorization();
builder.Services.AddCascadingAuthenticationState();
// ...
app.UseAuthentication(); app.UseBff(); app.UseAuthorization(); app.UseAntiforgery();
app.MapBff();            // POST /bff/login, POST /bff/logout, GET /bff/session
app.MapRazorComponents<App>().AddInteractiveServerRenderMode();
```

`UsePostgres` binds the section `BieberWorks:Bff:Postgres` of the host's configuration (`Schema`, `ApplicationName`, key
encryption key file, ...); the delegate only overrides it. Outside Development a key encryption key is mandatory (see
[Session store](#session-store)). Behind a reverse proxy, run `UseForwardedHeaders()` in the frontend first: the throttle and
the address passed to identity use the connection address as the host sees it.

Login and logout are plain HTML form posts. The forms must carry the antiforgery token:

```razor
@using Microsoft.AspNetCore.Components.Forms
<form method="post" action="/bff/login">
    <AntiforgeryToken />
    <input name="email" type="email" /><input name="password" type="password" />
    <input name="returnUrl" type="hidden" value="/admin" />
    <button type="submit">Sign in</button>
</form>
<form method="post" action="/bff/logout"><AntiforgeryToken /><button type="submit">Sign out</button></form>
```

::: tip Where the antiforgery token comes from
`<AntiforgeryToken />` needs the server to render the page: it works on static server-rendered pages and in interactive components **only when prerendering is on** (the token is created during the prerender and handed to the circuit). Render the login page statically (`@attribute [ExcludeFromInteractiveRouting]`, and in `App.razor` pass `null` as render mode when `!HttpContext.AcceptsInteractiveRouting()`), so signing in never depends on a circuit. A logout button in an interactive layout needs prerendering.
:::

Failed sign-ins redirect to `LoginPath?error=<code>` with the codes `invalid`, `unavailable`, `ratelimited`, `twofactor`, `unconfirmed` and `expired` (stale antiforgery token). `AuthorizeView` and `[Authorize]` work as usual; the principal carries the claims of the access token plus the `bw_sid` session claim. The claim **types** are the .NET ones: `ClaimTypes.NameIdentifier`, `ClaimTypes.Email` (the full URI, so `FindFirst("email")` finds nothing), `ClaimTypes.Name` (the email), `ClaimTypes.Role` and the plain `perm`. Without `@using Microsoft.AspNetCore.Components.Forms` the `<AntiforgeryToken />` tag is not recognised (warning RZ10012) and no token is rendered.

## Getting the token to your HttpClients

`IBffTokenAccessor.AccessToken` returns the current user's token inside an HTTP request (via `UseBff()`) and inside every Blazor circuit activity (via the registered circuit handler). The package deliberately knows nothing about how you attach it; connect it to the mechanism you use:

**ServiceKit service clients** (`ServiceTokenForwardingHandler` asks `IServiceTokenAccessor`):

```csharp
sealed class BffServiceTokens(IBffTokenAccessor bff) : IServiceTokenAccessor { public string? AccessToken => bff.AccessToken; }
services.AddSingleton<IServiceTokenAccessor, BffServiceTokens>();   // before AddServiceKitClient (it uses TryAdd)
```

**Auth forwarding** (`AddAuthForwarding()` on any `IHttpClientBuilder`):

```csharp
services.AddBieberWorksBff(...).AddAuthForwardingSource();   // IAuthForwardingSource that hands out the token as bearer
```

**Your own handler**: inject `IBffTokenAccessor` into a `DelegatingHandler` and set the `Authorization` header.

## What the BFF does

| Topic | Behaviour |
|---|---|
| Cookie | `__Host-bw.bff` (configurable), 256-bit random id, `HttpOnly`, `Secure`, `SameSite=Lax`, path `/`. It contains nothing else; a copied cookie is worthless once the session is gone from the store. |
| Antiforgery | `POST /bff/login` and `/bff/logout` validate the antiforgery token themselves (independent of `UseAntiforgery()` order). Login without a valid token redirects to `?error=expired` and never reaches identity; logout without a valid token answers 400 and changes nothing. |
| Session limits | Absolute (default 12 h) and idle (default 2 h), enforced on the server on every read. Activity is written at most once per `TouchInterval`. |
| Refresh | The access token is renewed `RenewBefore` (60 s) before it expires, once per session even under concurrent requests (lock). If identity is unreachable or throttles, the session stays alive with the old token and the renewal is retried on next use, at most every `RefreshRetryInterval` (10 s) so an outage does not add the connection timeout to every request (`RefreshFailingSince` is exposed through `BffSessionManager.PeekAsync` for a UI warning). Only an explicit rejection by identity ends the session. |
| Several hosts | Refresh tokens are single use. If another host renewed first, identity rejects the second one; the BFF then re-reads the store and adopts the new pair instead of ending the session. Writes of a renewal are conditional (`IBffSessionStore.ReplaceAsync`/`RemoveIfAsync`): they only succeed while the session still exists with the refresh token that was renewed. |
| Logout | Removes the session first (works with identity down), clears the cookie, then revokes the refresh token at identity (`POST api/auth/logout`, best effort, logged). A sign-out that happens while a renewal is in flight stays a sign-out: the renewal is discarded and the freshly issued refresh token is revoked. |
| Sign-in | New session id on every sign-in; a session still attached to the browser is ended (no session fixation). `returnUrl` must be a local path without control characters or backslashes; anything else falls back to `PostLoginPath` (checked before a session is created). |
| Throttle | `RateLimit` (on by default): sign-in attempts per client address (10/min), **failed** sign-ins per (address, account) pair (5/min, a success clears the pair), and a tarpit per account: after 30 failures/min from all addresses together each attempt on that account is delayed (250 ms per extra failure, at most 3 s). Sign-outs per address (30/min). Fixed windows in memory per instance. A throttled sign-in redirects to `?error=ratelimited` without calling identity; a throttled sign-out answers 429. An attacker can only block their own address for an account and slow down, never lock, the account: the owner signing in from another address always gets through. Outages and second-factor prompts do not count as failures. Identity keeps its own authoritative limits. |
| Client address | On sign-in the BFF sends the browser's connection address to identity in `X-Forwarded-For` (`ClientAddressHeader`, always set, never appended), so identity throttles and lists sessions per user. Identity honours the header only from trusted proxies/networks (`Identity:ForwardedHeaders`); configure that, otherwise all users share the frontend's address. |
| Cookies | The session cookie and the antiforgery cookie are `Secure` (`SecurePolicy`, default `Always`; both follow the same option). The antiforgery cookie gets its `Secure` flag from `UseBff()`, so it also works when TLS ends at a proxy and the app itself sees plain HTTP (ASP.NET Core's own `Always` would throw there). |
| Circuits | Every circuit activity runs with the user's token in `IBffTokenAccessor`. A revalidating `AuthenticationStateProvider` checks every `CircuitRevalidationInterval` (30 s) that the session still exists, so sign-out in another tab or a revoked refresh token ends the open circuit too. Revalidation does not count as activity. |
| Probe | `GET /bff/session` answers `200` with `{authenticated, accessExpires, refreshFailingSince}` or `401`. It never returns tokens. All BFF endpoints send `Cache-Control: no-store`. |

### Blazor circuit special cases

- A circuit has no usable `HttpContext`; the token comes from the circuit's own `AuthenticationStateProvider` and the session store, so it does not matter whether the circuit runs over WebSockets, Server-Sent Events or long polling.
- The authentication state of a circuit is a snapshot of the request that opened it. Roles refreshed by a token renewal reach the circuit on its next reconnect.
- `IHttpClientFactory` builds handlers in their own DI scope; the token therefore travels in an `AsyncLocal` (`BffTokenContext`), not in a scoped service.
- The token is cached per circuit and re-read from the session at most every `TouchInterval` or when it is about to expire, so a busy circuit does not query the store on every event.

## Session store

`IBffSessionStore` is the replaceable seam (`Get`, `Set`, `Touch`, `Remove`, plus the conditional `ReplaceAsync`/`RemoveIfAsync` with default implementations that stores should override atomically).

| Store | Use |
|---|---|
| `DistributedCacheBffSessionStore` (**default**) | Uses the registered `IDistributedCache` (Redis, SQL Server, ...), keyed by the SHA-256 of the session id; payloads are encrypted with Data Protection. **Single instance only:** `IDistributedCache` has no compare-and-set, so the activity touch (read, then write) can overwrite a token renewal of another host. Set `BieberWorks:Bff:MultipleInstances=true` to declare more than one instance: outside Development the host then refuses to start with this store. Without a distributed cache registration .NET falls back to a memory cache: sessions then end with the process, and a startup warning is logged outside Development. |

The cache store keeps a short-lived end marker (5 minutes) after a sign-out, so an activity touch that was already running cannot bring a signed-out session back. `IDistributedCache` has no compare-and-set, so renewals from several hosts can still overwrite each other; `MultipleInstances` is only a statement by you, it is not detected. For more than one instance use `UsePostgres`.
| `PostgresBffSessionStore` (`UsePostgres`) | **Recommended for more than one instance.** Table `bff_sessions` (created idempotently, safe for simultaneous starts), keyed by the SHA-256 of the session id (a reader of the table cannot replay a cookie), encrypted payload, conditional single-statement updates for renewal and touch, periodic sweeper for expired rows. |
| `InMemoryBffSessionStore` (`UseInMemorySessionStore`) | Tests and single-instance experiments only. |
| Your own | `builder.UseSessionStore<MyStore>()`. |

`UsePostgres` also stores the **Data Protection key ring** in the database (`bff_data_protection_keys`). Hosts that share sessions need a shared ring because the session payload and the antiforgery tokens are encrypted with it: a login page rendered by host A must validate on host B.

**Data Protection volume for the default store.** Without `UsePostgres`, ASP.NET Core keeps its Data Protection keys in the container's file system. They are lost when the container is replaced and then every session cookie, antiforgery token and cached session payload becomes unreadable (all users are signed out, login forms fail). Mount a persistent volume and point `PersistKeysToFileSystem` at it (and share it between instances), or use `UsePostgres`, which keeps the ring in the database.

**The ring is encrypted.** The ring decrypts every session payload, so it must not lie in clear text next to the sessions. Give every host the same *key encryption key*: a file with at least 32 random bytes written as Base64 or hex (for example `openssl rand -base64 48`; typed passphrases are refused). At start the host also proves that this key can decrypt the ring already stored in the database and refuses to start otherwise, so a host with a wrong key never creates a ring the others cannot read, mounted as a secret (`BieberWorks:Bff:Postgres:KeyEncryptionKeyFile=/run/secrets/bff_ring_key`). Every ring key is then encrypted with AES-256-GCM (key derived with HKDF-SHA256) before it is stored; the key itself never appears in logs or messages. An inline `KeyEncryptionKey` is accepted in Development only. **Outside Development the host refuses to start without a key encryption key** (there is no clear-text fallback). If you would rather protect the ring with a certificate or a KMS, pass `dataProtectionKeys: false` and configure `ProtectKeysWithCertificate(...)`/your own repository yourself; the ring must then be shared between hosts. Rotating the key encryption key makes old ring keys unreadable: sessions end and users sign in again.

**Give the BFF its own database or role.** The session table holds access and refresh tokens of every user. Use a dedicated database (or at least a dedicated schema plus a database role that can access only that schema) for `BffDb`, not the identity database and not an administrator account; use a different `Schema` and `ApplicationName` per website that must not share sessions.

**Least privilege (recommended in production).** By default the host creates the schema and tables at start, which needs DDL rights. Instead, create them once as the owner and run the host with a role that can only read and write that schema:

```csharp
// during deployment, as the owner: print or execute
var sql = BieberWorks.SDK.Auth.Bff.Postgres.BffPostgresDatabase.SetupScript("bff_site");
```

```sql
CREATE ROLE bff_site LOGIN PASSWORD '...';             -- from your secret store
GRANT USAGE ON SCHEMA bff_site TO bff_site;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA bff_site TO bff_site;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA bff_site TO bff_site;
```

Then set `BieberWorks:Bff:Postgres:ManageSchema=false`. The host verifies the tables at start and refuses to start with a clear message if they are missing or not accessible. **Rule of thumb: one role, one schema and one key encryption key per frontend** (site, admin, ...), so a compromised public site cannot read the admin sessions.

The package never drops tables. Unreleased 3.8.0 builds used other table names (`sessions`, `data_protection_keys`); if you ran such a build, drop those two tables (and the clear-text ring they hold) yourself. If you move the BFF to another database, also drop the old schema in the previous database.

Entries written with a key ring that is no longer available are treated as "no session" (the user signs in again) instead of failing the request.

## Using your own instead

Everything is a contract. Skip `MapBff()` and call `BffSessionManager.StartAsync/EndAsync` from your own endpoints, replace `IBffIdentityClient` for a different identity API (`UseIdentityClient<T>()`), replace the store, or ignore the package entirely and only keep the idea: the consumer never depends on a concrete type except through `IBffTokenAccessor`, `IBffSessionStore` and `IBffIdentityClient`.

## Options (`BieberWorks:Bff`)

| Key | Default |
|---|---|
| `CookieName` | `__Host-bw.bff` |
| `SameSite` | `Lax` |
| `SecurePolicy` | `Always` (use `SameAsRequest` or `None` only for plain-HTTP development hosts; the `__Host-` prefix needs `Secure`, so rename the cookie then) |
| `AbsoluteTimeout` / `IdleTimeout` | 12 h / 2 h |
| `TouchInterval` / `RenewBefore` / `RefreshRetryInterval` | 1 min / 60 s / 10 s |
| `CircuitRevalidationInterval` | 30 s |
| `EndpointPrefix` / `LoginPath` / `PostLoginPath` / `PostLogoutPath` | `/bff` / `/login` / `/` / `/` |
| `IdentityClientName` / `IdentityBaseAddress` | `bw-bff-identity` / none. Register your own named client (for example with resilience handlers) and set `IdentityClientName`, or just set `IdentityBaseAddress`. |
| `IdentityLoginPath` / `IdentityRefreshPath` / `IdentityLogoutPath` | `api/auth/login` / `api/auth/refresh` / `api/auth/logout` |
| `MultipleInstances` | `false` (see [Session store](#session-store)) |
| `RateLimit:Enabled` / `LoginPerAddress` / `FailuresPerAddressAndAccount` / `AccountDelayAfterFailures` / `AccountDelayStep` / `AccountMaxDelay` / `LogoutPerAddress` / `Window` | `true` / 10 / 5 / 30 / 250 ms / 3 s / 30 / 1 min |
| `ClientAddressHeader` | `X-Forwarded-For` (empty: do not pass the address on) |

Postgres (`BieberWorks:Bff:Postgres`): `ConnectionString`, `Schema` (`bff`), `SweepInterval` (10 min), `ApplicationName` (`BieberWorks.Bff`, keep identical on all hosts that share sessions), `KeyEncryptionKeyFile` (required outside Development), `KeyEncryptionKey` (Development only).

## Limits

- Two-factor sign-in is not driven by the BFF; it redirects with `?error=twofactor`.
- The BFF trusts the access token it receives over the back channel only to read claims; it does not validate signatures. Every service validates the token when it is presented.
- Several instances need the Postgres store (or another store with conditional updates). The distributed-cache store cannot update a session atomically; a concurrent activity touch can overwrite a token renewal of another host, whose next renewal is then rejected and signs the user out.
- A running Blazor circuit keeps working with its cached token for up to `TouchInterval` plus `CircuitRevalidationInterval` after a sign-out in another tab.
- The built-in throttle is per instance and in memory. For a limit that spans instances, throttle in front of the hosts and set `RateLimit:Enabled=false`.
