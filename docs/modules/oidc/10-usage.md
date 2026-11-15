# Usage

## Endpoints

| Path | Method | Purpose |
|---|---|---|
| `/.well-known/openid-configuration` | GET | Discovery. Needs no database. |
| `/.well-known/jwks.json` | GET | Public keys: the signing RSA key, rotated-out RSA keys and the legacy EC (ES256) key. Needs no database. |
| `/connect/authorize` | GET, POST | Authorization endpoint. |
| `/connect/token` | POST | Token endpoint (`authorization_code`, `refresh_token`). |
| `/connect/userinfo` | GET, POST | Userinfo. |

The discovery document advertises `response_types_supported=[code]`, `response_modes_supported=[query]`,
`code_challenge_methods_supported=[S256]` and `id_token_signing_alg_values_supported=[RS256]`.
Implicit, hybrid, password and device flows are off.

## Flow

1. The relying party sends the browser to `/connect/authorize` with `code_challenge` (S256), `state` and, for ID tokens, `nonce`.
2. Without an Auth session, the browser is challenged to `/auth/login?returnUrl=<the authorize request>`. Login protection,
   2FA and lockout are those of Auth. After login the browser returns to the same authorize request.
   `prompt=none` answers `login_required` instead.
3. With a session, the code is issued to the registered redirect URI.
4. The client exchanges the code at `/connect/token` with `code_verifier` and receives access token, ID token and (with `offline_access`) a refresh token.

## Tokens

| Token | Format | Notes |
|---|---|---|
| Access token | signed JWT (RS256), type `at+jwt`, not encrypted | Resource servers validate it offline against the JWKS. **Always** carries `aud`. |
| ID token | signed JWT (RS256) | `sub`, `sid`, `nonce`, and profile/email/roles claims by scope. |
| Authorization code | reference token | Single use, 60 s. |
| Refresh token | reference token (opaque handle) | Rotation on, absolute lifetime, reuse leeway 10 s. |

`sub` is the stable Auth user id, never the e-mail address. `sid` is the Auth session id.

### Claims by scope

| Scope | ID token / userinfo | Access token |
|---|---|---|
| `openid` | `sub`, `sid` | `sub`, `sid` |
| `profile` | `name`, `preferred_username`, `locale` | - |
| `email` | `email`, `email_verified` | - |
| `roles` | `roles` (array) | `role` (one claim per role) |
| `perm` | - | `perm` (one claim per permission) |
| `offline_access` | enables the refresh token | - |

Claims are recomputed from `IUserClaimsReader` at every code exchange and every refresh, so role changes appear with the next
refresh. A locked or unconfirmed account gets no token and its userinfo calls fail.

## Audience

`aud` is set from the client's `Audiences`, else from `Oidc:DefaultAudiences`. Configuration without at least one default
audience does not start. Resource servers must validate the audience.
