# Clients

Clients are seeded from `Oidc:Clients` at every host start. Seeding is idempotent: it creates missing clients and updates
existing ones to match the configuration. Clients that are removed from the configuration are **not** deleted (a later phase adds
administration for that). A UI for client administration and the consent page follow in phase P2.

| Key | Meaning |
|---|---|
| `ClientId` | Unique id. |
| `DisplayName` | Optional; defaults to the id. |
| `Type` | `Confidential` (default, needs a secret) or `Public` (no secret, PKCE only). |
| `ClientSecretFile` | Path of a secret file. The secret is never part of the configuration; the database stores only a hash (OpenIddict's PBKDF2 hashing). A secret that still matches is left untouched; a changed file rotates the secret at the next start. |
| `RedirectUris` | Exact matches only. No wildcards, no fragments; https, or http for `localhost`/loopback. Case, trailing slash and query differences do not match. |
| `PostLogoutRedirectUris` | Exact matches; used by end-session in a later phase. |
| `Scopes` | Scopes the client may request; must contain `openid`. Default `openid profile email`. `offline_access` enables refresh tokens. |
| `Audiences` | Audiences of the client's access tokens; empty means `Oidc:DefaultAudiences`. |

All clients use implicit consent in this phase (first-party clients such as Grafana). Every client requires PKCE.
Client authentication at the token endpoint: `client_secret_basic` and `client_secret_post`.
