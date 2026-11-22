# Operations

## Keys

- **RSA signing key**: provided by Auth (`IJwtKeyProvider`), same mechanism and rotation as the EC key. The active RSA key
  signs; keep a rotated-out key in the Auth key set for at least the access token lifetime plus the consumers' JWKS refresh
  interval, then remove it. The module publishes every valid key of the provider in the JWKS.
- **Encryption key**: 32 random bytes, Base64, in a secret file (`Oidc:EncryptionKeyFile`), for example
  `openssl rand -base64 32 > oidc_encryption_key`. Mount it as a Docker secret on every instance. Replacing it invalidates all
  stored authorization codes and refresh tokens (users sign in again); there is no rotation with overlap yet.

## Reverse proxy

Run the host with the ServiceKit profile `ServiceHost:ReverseProxy` (`Proto` and `Host` trusted, known proxies or networks
listed). Test that `authorization_endpoint` in the discovery document starts with `Oidc:Issuer`. The session cookie must be
`SameSite=Lax` and `Secure`, otherwise the browser does not send it on the navigation from the relying party to `/connect/authorize`
and the user appears logged out every time.

## Start-up failures

| Message | Cause |
|---|---|
| `Oidc:Issuer must be ...` | Issuer not an absolute, normalized https URL. |
| `Oidc:DefaultAudiences needs ...` | No default audience. |
| `Oidc:EncryptionKeyFile is required in Production` | Secret file not configured. |
| `No IJwtKeyProvider is registered` | Auth runs without asymmetric signing. |
| `... Auth has no active RSA signing key ... 'ActiveRsaKid'` | No RSA key is active. Add an RSA key with a private part to the Auth signing keys and set `ActiveRsaKid` to its kid; an EC key alone is not enough. The host checks this at start. |
| `Oidc:Clients '<id>': secret file ... does not exist` | Client secret file missing. |

A call to discovery or JWKS over plain http is rejected in Production; see [Usage](./10-usage.md). If a health probe fails this
way, probe over https or through the proxy that sets `X-Forwarded-Proto: https`.

## Pruning

Without cleanup the token and authorization tables grow with every sign-in. The hosted service `OidcPruningService` calls
`IOpenIddictTokenManager.PruneAsync` and then `IOpenIddictAuthorizationManager.PruneAsync` on a timer:

| Key | Default | Meaning |
|---|---|---|
| `Oidc:Pruning:Enabled` | `true` | `false` switches the service off (logged at start); rows then stay. |
| `Oidc:Pruning:Interval` | `06:00:00` | Time between runs, at least one minute. The first run follows 30 to 120 seconds (random) after host start, then every interval. |
| `Oidc:Pruning:Threshold` | unset | Only rows created before now minus this age are removed. Unset = derived from the refresh token lifetime: the larger of `RefreshTokenLifetimeSeconds` and one day (14 days by default). An explicit value must not be shorter than `RefreshTokenLifetimeSeconds` (the validator stops the host otherwise). |

Removed: expired, revoked, redeemed and rejected tokens and authorizations without a live token; never removed: valid tokens and valid
permanent consents. Each run uses its own DI scope, runs never overlap, a run is cancelled when the host stops, and a failing step is
logged as an error (`Pruning run failed (token|authorization)`), counted, and tried again by the next run; it never stops the host or the
other step. Several instances may run the service at the same time; the
deletes are idempotent.

**First run on large tables.** A database that was never pruned can hold millions of old rows, and the first run deletes them in one
pass. Upgrade in a maintenance window or at low load, or start with `Oidc:Pruning:Enabled=false` and enable it once the window has
begun (a restart is needed).

## Account deletion

On `UserAccountDeletionRequestedEvent` (from `BieberWorks.SDK.SharedKernel`, published by the Auth module after an account is deleted,
whether by an administrator or by the user) the provider deletes every token, authorization and permanent consent whose `subject` is
the deleted user, in its own database only. The handler is idempotent, so a repeated event, an unknown user or a repeated erasure after a partial
failure is harmless. The event is delivered once, in process, right after the commit of the deletion (no outbox): **there is no automatic
retry**. A failure is logged as an error with the user id, counted as `bieberworks.oidc.subject.erased{outcome=failed}` and rethrown to the
publisher. Repeat the removal manually or through the Legal erasure (`IUserDataEraser`). The same removal is registered as `IUserDataEraser` (module name `BieberWorks.SDK.Oidc`, all rows removed in every
`ErasureMode`), which a host with the privacy orchestrator of `BieberWorks.SDK.Legal` calls as part of its erasure. No impact provider is
registered: removing sign-in state needs no warning in the deletion dialog.

## Telemetry

Meter `BieberWorks.SDK.Oidc`. Instruments: `bieberworks.oidc.authorize.requests{outcome}`,
`bieberworks.oidc.token.requests{grant_type,outcome}`, `bieberworks.oidc.token.rate_limited{policy}`,
`bieberworks.oidc.endsession.requests{outcome}`, `bieberworks.oidc.pruned{kind}` (rows removed, kind `token` or `authorization`),
`bieberworks.oidc.pruning.failures{kind}` and `bieberworks.oidc.subject.erased{outcome}` (`removed`, `nothing_found` or `failed`). Tag values come
from fixed sets.

## Upgrade notes 0.5.0

Behavior changes with defaults you must act on:

1. **The administration API is off.** `Oidc:AdminApi:Enabled` defaults to `false`; the routes under `/api/v1/oidc` answer 404 until you set
   it to `true`. Hosts that call the API (the `Oidc.Client` package, scripts) fail with 404 after the upgrade until you do.
2. **New required scope `identity.admin`.** The API no longer accepts the scope `perm`. Add `identity.admin` to the allowed scopes of
   every client that signs in an administrator: configured clients are seeded again at start; clients created through the API need a
   `PUT /clients/{clientId}` with the scope added (or edit them in the admin UI). Administrators sign in again to get a token with the
   scope. To keep the old behavior, set `Oidc:AdminApi:RequiredScope` to `perm`.
3. **Live permission check.** Rights are read from the user store on every request, so the user store (`IUserClaimsReader`) must be
   reachable for the admin API; token claims no longer count.
4. **Pruning is on** (every 6 hours, threshold derived from the refresh token lifetime, first run 30 to 120 seconds after start). The first
   run may delete many old rows at once, see above. Disable it with `Oidc:Pruning:Enabled=false`. Hosts with a refresh token lifetime
   above 14 days need no change: the derived threshold follows it.
5. **Account deletion removes the user's tokens and consents** (needs the event of Auth 4.10 or later; the module requires Auth.Contracts 4.10).

No database migration is needed.

## Outage behavior

Discovery and JWKS need no database. With the database down, authorize, token and userinfo fail; services that validate access
tokens offline keep working until the tokens expire.
