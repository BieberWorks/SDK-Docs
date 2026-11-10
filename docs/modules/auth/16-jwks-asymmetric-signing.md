# Asymmetric JWT signing and JWKS

By default Auth signs access tokens with HS256 and the shared `JwtSettings:Secret`.
Setting `JwtSettings:SigningMode` to `Asymmetric` switches to **ES256**: only Auth holds the
private key, other services verify tokens with the public keys published as a JWKS.
The default (`Symmetric`) is unchanged, so existing consumers need no changes.

## Configuration

```json
{
  "JwtSettings": { "SigningMode": "Asymmetric", "Issuer": "https://identity.example", "Audience": "my-services" },
  "BieberWorks": { "Auth": { "JwtSigning": {
    "ActiveKid": "2026-11",
    "JwksCacheSeconds": 300,
    "Keys": [
      { "Kid": "2026-11", "PrivateKeyPem": "<from secret store>" },
      { "Kid": "2026-05", "PublicKeyPem": "-----BEGIN PUBLIC KEY-----..." }
    ]
  } } }
}
```

- Keys are P-256 PEM (PKCS#8/SEC1 private, SPKI public). Supply `PrivateKeyPem` via environment
  variables or a secret store, never commit it. All servers of one deployment receive the same
  configuration, so multi-server setups need no shared folder.
- **Preferred: key from a file.** Set `PrivateKeyFile` to the path of a PEM file (for example a Docker/Kubernetes secret at
  `/run/secrets/signing-key`) instead of `PrivateKeyPem`. The file is read once at start; its content is never logged or
  echoed in an error. With environment variables: `BieberWorks__Auth__JwtSigning__Keys__0__PrivateKeyFile=/run/secrets/signing-key`.
  Startup fails when the file is missing, empty or not a P-256 PEM key.
- `AllowInlinePrivateKey` (default `true`, compatible) set to `false` rejects an inline `PrivateKeyPem` at start so a key
  cannot end up in plain configuration. Service hosts (Identity) switch it off outside `Development`.
- `JwtSigningKeyGenerator.Generate(kid)` creates a new key pair.
- Startup validation fails when no key, a duplicate `Kid`, or no private key for `ActiveKid` is configured.
- Storage is swappable: register your own `IJwtSigningKeyStore` (e.g. database- or vault-backed)
  before or after the module (this is the seam for a later vault/KMS integration); the config/file-backed `ConfigJwtSigningKeyStore` is registered with `TryAdd`.

## Rotation

1. Generate a new key and add it to `Keys`; set `ActiveKid` to its `Kid`.
2. Keep the previous key (public part is enough) listed until every token signed with it expired
   (longer than `AccessTokenExpirationMinutes`); consumers refresh the JWKS via the `kid` header.
3. Remove the old key.

::: warning Removal reaches consumers late
Consumers cache the JWKS. Removing a signing key (for example after a compromise) only takes effect at a consumer after its next metadata refresh; until then it still accepts tokens signed with the removed key. Give consumers a bounded refresh interval, for example `AutomaticRefreshInterval` of the JWT bearer `ConfigurationManager` (or the matching ServiceKit option) of 5 to 15 minutes, and plan for that delay in your incident procedure. Unknown `kid` values trigger an immediate refresh, but a key that is merely *gone* from the set is only noticed by the periodic refresh.
:::

## Endpoints (asymmetric mode only)

| Path | Content |
|---|---|
| `/.well-known/jwks.json` | public keys only, `Cache-Control: public, max-age=<JwksCacheSeconds>` |
| `/.well-known/openid-configuration` | minimal discovery document (`issuer`, `jwks_uri`) |

`jwks_uri` is built from `BieberWorks:Auth:JwtSigning:PublicBaseUrl` when set, otherwise from `JwtSettings:Issuer` when that
is an absolute http(s) URL. The request's `Host` header is used only when neither is configured, because a caller controls
it and the document is cached publicly (`Cache-Control: public`). Set `PublicBaseUrl` when the address under which consumers
reach the service differs from the issuer string.

Consumers using `JwtBearer` should point `MetadataAddress` (or `Authority`) at the
**discovery document**. `JwtBearer` does not read a bare JWKS URL as `MetadataAddress`.

## Validation inside Auth

Auth keeps validating its own bearer tokens, refresh path and 2FA challenge tokens with the
configured keys. In asymmetric mode only `ES256` is accepted (no `alg=none`, no HS256 tokens).
Token claims (`sub`, `email`, `role`, `jti`) are unchanged; access and service tokens additionally carry `iat` so that consumers can derive the lifetime.

## Audiences and permission claims for services

Two additive, opt-in `JwtSettings` options let services without access to the role store authorize from the token alone:

| Setting | Default | Effect |
|---|---|---|
| `AdditionalAudiences` | `[]` | Extra values in the `aud` claim next to `Audience`, for example the names of services that accept user tokens. |
| `IncludePermissionClaims` | `false` | The permissions granted by the user's roles are added as `perm` claims. `Core.Authorization` evaluates direct `perm` claims, so a service only needs the permission catalog of its own modules. A wildcard `*` in a role stays `*` and expands against the receiving service's catalog. |

Changes to roles take effect when the access token is renewed (short token lifetime, see the identity-outage rule of the service concept).

## Service tokens (client credentials)

For calls without a user (for example an outbox relay) configure service accounts:

```json
{
  "BieberWorks": { "Auth": { "ServiceAccounts": { "Accounts": [
    { "ClientId": "identity-relay",
      "SecretSha256": "<lower-case hex SHA-256 of the secret, supplied via secret store>",
      "Audiences": ["communication"],
      "Permissions": ["email:send"],
      "LifetimeMinutes": 60 }
  ] } } }
}
```

* `POST /api/v1/auth/service-token` (form: `grant_type=client_credentials`, `client_id`, `client_secret`, `audience`) returns
  `{ access_token, token_type, expires_in }`. The endpoint is only mapped when at least one account has a `SecretSha256`.
* The token is signed like user tokens (ES256 with JWKS when asymmetric), has `sub = svc:<ClientId>`, the requested
  audience, and the configured `perm` claims. Wrong secret: `401`; audience not configured for the account: `403`.
* Code inside the identity host can use `IServiceTokenIssuer.IssueTrustedAsync` without a secret. Never expose it over HTTP.
* Only the SHA-256 of the secret is stored (it must be a 64-character hex value, anything else never authenticates). Use
  high-entropy secrets (32+ random bytes).
* Hardening: every attempt takes a slot before the secret is checked (so parallel guesses cannot exceed the budget) and a
  successful call gives it back, so only failures accumulate. Attempts for a **configured** `client_id` are counted per
  client address and client id against `auth:service-token-failures-client`; attempts with an unknown client id share one
  bucket per address, `auth:service-token-failures-ip` (both default to 10 per 5 minutes, then `429` with `Retry-After` for
  5 minutes). Junk requests from an address therefore cannot lock out the real services, but wrong secrets for one
  service lock that service out for the same address, even with the correct secret afterwards. IPv6 clients are counted
  per `/64`, and the default in-process limiter drops expired entries, so rotating source addresses neither bypasses the
  limit nor grows memory. Counters are per process: with several instances the budget applies per instance unless a shared
  limiter store is configured.
* **Behind a reverse proxy** the client address is the proxy's address unless the host trusts `X-Forwarded-For` from that
  proxy (`UseForwardedHeaders` with `KnownProxies`/`KnownNetworks`, or `Identity:ForwardedHeaders` in the Identity host).
  Without it, failed attempts from anyone are counted against the proxy address and can lock the affected services out for
  everyone behind it. Configure the trusted proxies whenever service accounts are used. The header is never read by Auth
  itself, so it cannot be spoofed to evade the limit.
* The request must be a form of at most 4 KB with a `Content-Length` header (chunked uploads without a length are rejected),
  every field once and at most 512 characters, otherwise `400 invalid_request`. The lifetime is
  clamped to 1..60 minutes. The audience must exactly match one configured for the account, there is no scope parameter and
  the permissions always come from the account configuration, so a caller cannot obtain more than configured. The start
  fails when an account has an empty, duplicate or colon-containing `ClientId`, or an audience equal to this API's own
  audience (`JwtSettings:Audience` / `AdditionalAudiences`), because Auth would then accept the service token as a bearer
  token. Unknown
  clients cost the same work as wrong secrets (no timing hint). Responses carry `Cache-Control: no-store`.
