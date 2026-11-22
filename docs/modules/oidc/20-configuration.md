# Configuration

## Database

The connection string is resolved from `ConnectionStrings:OidcDb`, then `ConnectionStrings:DefaultConnection`. The module
uses its own PostgreSQL schema `oidc` (four OpenIddict tables and the migration history). It holds subjects and session ids
as plain strings; there is no foreign key to any table of another module. The module applies its migration at host startup.

```json
{
  "ConnectionStrings": {
    "OidcDb": "Host=localhost;Database=bieberworks;Username=postgres;Password=postgres"
  }
}
```

Create further migrations with
`dotnet ef migrations add <Name> --project src/BieberWorks.SDK.Oidc --startup-project src/BieberWorks.SDK.Oidc --output-dir Data/Migrations`
(set `ConnectionStrings__OidcDb` for the process, build first, do not use `--no-build`).

## Section `Oidc`

| Key | Default | Meaning |
|---|---|---|
| `Issuer` | required | Absolute https URL without query or fragment, in its normalized form. A host-only issuer ends with a slash (`https://id.example.com/`). Fixed by configuration, never taken from the request. |
| `EncryptionKeyFile` | - | Secret file with the 256-bit encryption key as Base64 (32 bytes). Required in Production. |
| `DefaultAudiences` | required | Audiences (`aud`) of access tokens for clients without their own list. At least one. |
| `Clients` | `[]` | Statically configured clients, see [Clients](./30-clients.md). |
| `AuthorizationCodeLifetimeSeconds` | 60 | |
| `AccessTokenLifetimeSeconds` | 900 | |
| `IdentityTokenLifetimeSeconds` | 600 | |
| `RefreshTokenLifetimeSeconds` | 1209600 | Absolute (14 days); the lifetime does not slide. |
| `RefreshTokenReuseLeewaySeconds` | 10 | A just-rotated refresh token may be presented again within this window. |
| `TokenRequestsPerMinutePerIp` | 60 | Policy `oidc:token-ip`. |
| `TokenRequestsPerMinutePerClient` | 120 | Policy `oidc:token-client`. |
| `EndSessionConfirmPath` | `/connect/logout` | Local path of the sign-out confirmation page that an end-session request without proof of intent is redirected to. The host or the Consent UI package renders it; it posts back to `/connect/endsession` with an antiforgery token. |
| `EndSessionCompletedPath` | `/` | Local path the browser lands on after a sign-out without `post_logout_redirect_uri`. |
| `EndSession:RevokeSessionTokens` | `true` | Also revoke the refresh tokens issued in the ended browser session. Access tokens stay valid until `exp`. |
| `AdminApi:AllowedClients` | empty | Client ids (`client_id`, else `azp`) allowed to call the admin API; the scope `perm` is always required. Empty = every client with `perm`, logged as a warning at start. Read at start. |

The re-authentication marker of `prompt=login` and `max_age` uses Data Protection: all instances must share one key ring.

Invalid configuration stops the host at startup with the list of problems.

## Fixed profile (not configurable)

Authorization code flow and refresh tokens only. PKCE with S256 is mandatory for every client; `plain` is off. Only
`response_mode=query`. Access tokens are signed, unencrypted JWTs. Refresh tokens are reference tokens with rotation.
HTTPS is mandatory; it can be switched off only when the host environment is `Development`.

## Dependencies on the host

`IJwtKeyProvider` with an active RSA key and `IUserClaimsReader` (both from Auth), and optionally the rate limiter
(`BieberWorks.SDK.RateLimiting`). Without a registered rate limiter the token endpoint is not rate limited; the module logs a
warning at startup.
