# Usage

## Endpoints

| Path | Method | Purpose |
|---|---|---|
| `/.well-known/openid-configuration` | GET | Discovery. Needs no database. |
| `/.well-known/jwks.json` | GET | Public keys: the signing RSA key, rotated-out RSA keys and the legacy EC (ES256) key. Needs no database. |
| `/connect/authorize` | GET, POST | Authorization endpoint. |
| `/connect/token` | POST | Token endpoint (`authorization_code`, `refresh_token`). |
| `/connect/userinfo` | GET, POST | Userinfo. |
| `/connect/endsession` | GET, POST | End-session (RP-initiated logout), advertised as `end_session_endpoint`. |
| `/connect/logout` | GET | Sign-out confirmation page (path configurable, see `EndSessionConfirmPath`). |

> **Discovery and JWKS need https requests in Production.** The module only answers requests that arrive over https (directly or,
> behind a reverse proxy, with a trusted forwarded `Proto: https`). A plain `http://` call, for example a health probe or a
> `curl` against the container port, is rejected. Call the public https address, or let the proxy forward `X-Forwarded-Proto: https`
> and run the host with the ServiceKit profile `ServiceHost:ReverseProxy`. Only the `Development` environment may use plain http.

The discovery document advertises `response_types_supported=[code]`, `response_modes_supported=[query]`,
`code_challenge_methods_supported=[S256]`, `prompt_values_supported=[none, login, consent, select_account]` and `id_token_signing_alg_values_supported=[RS256]`.
Implicit, hybrid, password and device flows are off.

## Flow

1. The relying party sends the browser to `/connect/authorize` with `code_challenge` (S256), `state` and, for ID tokens, `nonce`.
2. Without an Auth session, the browser is challenged to `/auth/login?returnUrl=<the authorize request>`. Login protection,
   2FA and lockout are those of Auth. After login the browser returns to the same authorize request.
   `prompt=none` answers `login_required` instead.
3. With a session, the code is issued to the registered redirect URI. The ID token carries `auth_time` (the login time of the session).
4. The client exchanges the code at `/connect/token` with `code_verifier` and receives access token, ID token and (with `offline_access`) a refresh token.

### Forcing a new login: `prompt` and `max_age`

`prompt=login`, `prompt=select_account` (there is one session per browser, so choosing an account means logging in again) and
a `max_age` that the session exceeds force a real re-authentication. `prompt=none` combined with another value is refused
(400); `prompt=none` with an exceeded `max_age` answers `login_required`. `max_age=0` is equivalent to `prompt=login`.
Since 0.2.0 this ends after one login, without a redirect loop. In 0.1.2 and earlier `max_age=0` loops (use `max_age=N`
with N of at least 300 there).

How it works: the first forcing request is answered with a redirect to itself, without `prompt=login` and with a short-lived
(5 minutes), data-protected marker `bw_reauth` ("this client asked for a fresh login at time T"). The login page returns to
that URL; a session issued at or after T satisfies the request. `max_age` stays in force, with a 60 s grace after the login so
that `max_age=0` terminates. A replayed URL (for example via the back button) after that grace has to log in again.

> **Verify `auth_time` in the relying party.** `prompt` and `max_age` travel through the front channel (the browser) and are
> not integrity protected, so a user can strip `prompt=login` from the URL. A relying party that needs a fresh login must
> check `auth_time` (and its own `max_age`) in the ID token and refuse a token whose login is too old.

> **All instances need the same Data Protection key ring.** The marker is protected with ASP.NET Core Data Protection, like the
> auth cookie and antiforgery tokens. An instance that cannot read a marker treats it as missing and sends the user to log in
> again, which can loop behind a load balancer whose instances have separate key rings.

## Signing out at the provider

Ending the local session of a relying party does not end the session at the provider. To sign the user out there, redirect
the browser to `end_session_endpoint` (`/connect/endsession`) with `id_token_hint`, `client_id`, `post_logout_redirect_uri`
and `state`. The `client_id` is optional when a valid `id_token_hint` is sent; without a hint it is required for
`post_logout_redirect_uri`. The `post_logout_redirect_uri` must be registered at the client of the hint or at the given
`client_id` (`PostLogoutRedirectUris`); an unregistered one gets a 400 and no redirect.
Without it the browser lands on `Oidc:EndSessionCompletedPath`.

* ASP.NET Core relying party: keep the ID token (`SaveTokens = true` or server-side), set `SignedOutCallbackPath`, then call
  `SignOutAsync(CookieScheme)` and `SignOutAsync(OpenIdConnectDefaults.AuthenticationScheme, new() { RedirectUri = ... })`;
  the handler adds `id_token_hint` and `post_logout_redirect_uri`.
* Other clients: redirect to `end_session_endpoint` with the parameters above.

A sign-out revokes the Auth session, deletes the auth cookie and revokes the refresh tokens issued in that browser session
(`Oidc:EndSession:RevokeSessionTokens`, default `true`). This includes clients with explicit consent: their tokens hang on a
per-session authorization, the permanent consent grant is kept. Access tokens stay valid until they expire. Refresh tokens of
other sessions of the same user stay valid.

A request signs the user out at once only if it proves intent: no session exists, or a valid `id_token_hint` names the
signed-in user, or a form post carries a valid antiforgery token. Everything else (a plain link, an image, a hint of another
user, a signed-in browser whose cookie carries no session id) is redirected to the confirmation page, so a foreign page cannot
sign a user out.

> Back-channel logout (server-side notification of other relying parties) and a helper package for the relying-party side are
> not part of this version and may follow later.

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
| `identity.admin` | - | no claim; the scope itself opens the [administration API](./30-clients.md#admin-api) (together with a live permission check) |

Claims are recomputed from `IUserClaimsReader` at every code exchange and every refresh, so role changes appear with the next
refresh. A locked or unconfirmed account gets no token and its userinfo calls fail.

## Stored data and cleanup

The provider stores tokens (refresh tokens, authorization codes, reference tokens) and authorizations (one per sign-in session plus
the permanent consent grants of explicit-consent clients) in its own schema. Two mechanisms keep this data in bounds:

- **Pruning.** A background service removes dead rows on a schedule, see [Operations](./50-operations.md#pruning). Live tokens and
  valid consents are never touched.
- **Account deletion.** When the user store deletes an account it publishes `UserAccountDeletionRequestedEvent`; the provider
  removes every token, authorization and consent of that `sub` at once (see [Operations](./50-operations.md#account-deletion)).
  A host that runs the privacy orchestrator of `BieberWorks.SDK.Legal` gets the same removal through `IUserDataEraser`.

## Audience

`aud` is set from the client's `Audiences`, else from `Oidc:DefaultAudiences`. Configuration without at least one default
audience does not start. Resource servers must validate the audience.
