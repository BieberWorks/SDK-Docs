# SDK-Oidc

OpenID Connect provider for the BieberWorks SDK. It adds the authorization-code flow with PKCE, discovery, JWKS, token
and userinfo endpoints to a host that already runs `BieberWorks.SDK.Auth`. Login, 2FA, lockout and sessions stay with
Auth; this module only builds on the Auth cookie session. The protocol engine is [OpenIddict](https://documentation.openiddict.com/)
(pinned to exactly 7.8.0); no OpenIddict type is part of the public contracts.

Status: phase P1 (core protocol). Consent UI, client administration UI, end-session, back-channel logout, revocation and
federation follow in later phases.

## Packages

- `BieberWorks.SDK.Oidc.Contracts`: options (`OidcOptions`, `OidcClientOptions`), scope names, rate-limit policy names, permissions.
- `BieberWorks.SDK.Oidc`: the module (`OidcModule`), `OidcDbContext` (schema `oidc`), endpoints, key setup, client seeder.

## See also

- [Getting Started](./01-getting-started.md)
- [Usage](./10-usage.md)
- [Configuration](./20-configuration.md)
- [Clients](./30-clients.md)
- [Security](./40-security.md)
- [Operations](./50-operations.md)
- [Changelog](./90-changelog.md)
