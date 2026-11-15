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
| Cache | Userinfo and OpenIddict token responses are `no-store`. |
| Transport | HTTPS is mandatory (only `Development` may relax it). The issuer is fixed by configuration. The endpoint URLs in the discovery document follow the request, so the host must trust the forwarded `Proto` and `Host` of its proxy only. |

## Known limits of this phase

- Access tokens stay valid until `exp` (default 15 min) after revocation or rotation; resource servers validate offline.
- Revocation, introspection, end-session and back-channel logout are not implemented yet.
- Expired tokens and authorizations are not pruned yet.
- Rate limits are per process (in-memory limiter).
