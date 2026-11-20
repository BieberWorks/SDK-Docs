# Getting Started

## Prerequisites

The host must provide, through `BieberWorks.SDK.Auth`:

- asymmetric signing (`SigningMode=Asymmetric`) with **at least one active RSA key** in addition to the legacy EC key
  (`IJwtKeyProvider` from `BieberWorks.SDK.Auth.Contracts`, Auth 4.4 or later),
- the cookie scheme and the login page (`/auth/login`), which an unauthenticated authorize request is sent to,
- `IUserClaimsReader` (user data for ID token and userinfo).

The module references `Auth.Contracts` only and never the Auth implementation.

## Registration

The module registers itself through `IModule` discovery. Reference the package in the host and call
`AddBieberWorksModules` / `MapBieberWorksModules` as usual.

```xml
<PackageReference Include="BieberWorks.SDK.Oidc" Version="0.*-*" />
```

Because the module registers `IOidcDiscoveryOwner`, Auth stops mapping its own minimal `/.well-known/openid-configuration`
and `/.well-known/jwks.json`; this module serves both, so they are never mapped twice.

## Minimal configuration

```json
{
  "Oidc": {
    "Issuer": "https://id.example.com/",
    "EncryptionKeyFile": "/run/secrets/oidc_encryption_key",
    "DefaultAudiences": [ "identity-api" ],
    "Clients": [
      {
        "ClientId": "grafana",
        "ClientSecretFile": "/run/secrets/oidc_grafana",
        "RedirectUris": [ "https://grafana.example.com/login/generic_oauth" ],
        "Scopes": [ "openid", "profile", "email", "roles", "offline_access" ]
      }
    ]
  }
}
```

Behind a reverse proxy the host must trust the forwarded `Proto` and `Host` headers of that proxy (ServiceKit profile
`ServiceHost:ReverseProxy`). The issuer is fixed by `Oidc:Issuer`, but the endpoint URLs in the discovery document are built
from the request.
