# Security

| Topic | Behavior |
|---|---|
| PKCE | Required for every client, S256 only. Requests without `code_challenge` or with `plain` are refused. |
| Redirect URIs | Exact match; an unknown or non-matching URI gets a 400 and **no redirect** (no open redirect). |
| Response modes | `query` only. `form_post` would need a cross-site POST that the `SameSite=Lax` session cookie does not survive; `fragment` belongs to implicit flows. |
| Signing | RS256 signs ID and access tokens. The legacy ES256 key (tokens of the Auth login API) and rotated-out RSA keys appear in the JWKS only, so services validating both token families need one JWKS. No development or ephemeral signing credential is ever registered (an architecture test checks the sources). |
| Encryption key | Codes and refresh payloads are stored encrypted with a 256-bit key from a secret file. It must be persistent and identical on all instances. Production aborts at startup without the file; other environments use a random key and log a warning (tokens then die with the process). |
| Audience | An access token always has `aud`. Without default audiences the configuration is invalid. |
| Refresh tokens | Reference tokens, rotation on, reuse after the 10 s leeway fails with `invalid_grant` and revokes all tokens of that authorization. Account lockout or removal blocks refresh. |
| Client secrets | Stored as hashes only; read from files; never logged. |
| Account state | Authorize answers `access_denied` for unknown, locked and unconfirmed accounts alike, and reveals nothing else. |
| Rate limits | Token endpoint: per client address and per client id, answered with `429` and `Retry-After` before client authentication runs. Login protection is Auth's. |
| End-session | Signs out at once only with proof of intent (no session, a valid `id_token_hint` of the signed-in user, or a form post with antiforgery token); otherwise a confirmation page. `post_logout_redirect_uri` needs `client_id` or a valid `id_token_hint`; it must be registered at that client, otherwise 400 without redirect. Refresh tokens of the ended session are revoked; access tokens live until `exp`. |
| Forced login | `prompt=login`, `select_account` and `max_age` are enforced with a data-protected marker (same Data Protection key ring on all instances). Relying parties must verify `auth_time`: `prompt` is not integrity protected in the front channel. |
| Cache | Userinfo and OpenIddict token responses are `no-store`. |
| Transport | HTTPS is mandatory (only `Development` may relax it). The issuer is fixed by configuration. The endpoint URLs in the discovery document follow the request, so the host must trust the forwarded `Proto` and `Host` of its proxy only. |

## Client administration API

The routes under `/api/v1/oidc` return client secrets, so they need more than a permission. Every route requires a bearer access token
with the scope `perm` (a token without a scope claim, such as one from the old login, or with `openid roles` only gets 403), the
permission `oidc:clients:manage` of its user and, when `Oidc:AdminApi:AllowedClients` is set, an allowed `client_id` (else `azp`).
An empty allowlist lets every client with the scope `perm` call the API for an administrator; the provider warns at start. The list is
read at start (a change needs a restart). Removing an administrator takes effect when the issued access token expires. See
[Clients](30-clients.md#access-token-requirements).

## Permission catalog in admin-only hosts

`AddOidcAdminPresentation()` (called by the admin UI module) contributes `oidc:clients:manage` to the Core.Authorization
catalog itself. A host that runs only the admin UI with `BieberWorks.SDK.Oidc.Client` (no `BieberWorks.SDK.Oidc`
implementation) therefore needs no `IPermissionContributor` of its own: a `*` grant expands to the permission and the
admin pages no longer answer 403. In a host that also runs the implementation the permission is listed once (the
catalog de-duplicates by key).

## Known limits of this phase

- Access tokens stay valid until `exp` (default 15 min) after revocation or rotation; resource servers validate offline.
- Token revocation endpoint, introspection and back-channel logout are not implemented yet (back-channel logout and a relying-party helper package may follow).
- Expired tokens and authorizations are not pruned yet.
- Rate limits are per process (in-memory limiter).
