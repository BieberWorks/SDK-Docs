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

## Telemetry

Meter `BieberWorks.SDK.Oidc`. Instruments: `bieberworks.oidc.authorize.requests{outcome}`,
`bieberworks.oidc.token.requests{grant_type,outcome}`, `bieberworks.oidc.token.rate_limited{policy}`. Tag values come from fixed sets.

## Outage behavior

Discovery and JWKS need no database. With the database down, authorize, token and userinfo fail; services that validate access
tokens offline keep working until the tokens expire.
