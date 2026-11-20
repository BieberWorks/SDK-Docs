# Configuration

| Key | Default in the image | Meaning |
| --- | --- | --- |
| `ConnectionStrings:AuthDb` | none (required) | PostgreSQL for the `auth` schema |
| `ConnectionStrings:ServiceDb` | `AuthDb` | PostgreSQL for the transport tables (schema `servicekit`) |
| `ConnectionStrings:OidcDb` | `AuthDb` | PostgreSQL for the OpenID Connect provider (schema `oidc`, own migration history). Derived from `AuthDb` when not set; the connect and command timeouts and the short retry budget (`Database:*`) apply to it as well |
| `JwtSettings:Issuer` | none (required) | Issuer string; services must use the same value as `Authority` |
| `JwtSettings:Audience` | `identity` | Audience of tokens for this service |
| `JwtSettings:AdditionalAudiences` | `["communication"]` | Services that accept user tokens. Never put a service-token audience here |
| `JwtSettings:IncludePermissionClaims` | `true` | Add role permissions as `perm` claims |
| `JwtSettings:SigningMode` | `Asymmetric` | ES256 with JWKS |
| `JwtSettings:AccessTokenExpirationMinutes` | `15` | Access token lifetime |
| `BieberWorks:Auth:JwtSigning:*` | none (required) | `ActiveKid` (EC key, ES256: legacy sign-in tokens) **and `ActiveRsaKid`** (RSA key of at least 3072 bit, RS256: the OpenID Connect provider signs with it; the JWKS publishes both). `Keys` holds both entries (`Kid`, `PrivateKeyFile` for the active keys, `PublicKeyPem` for retired keys). Inline `PrivateKeyPem` only in Development. Without `ActiveRsaKid` the start fails ("No active signing key for algorithm 'RS256'") |
| `BieberWorks:Auth:ServiceAccounts:Accounts` | relay account | Service accounts (`identity-relay` may request tokens for the dedicated audience `communication-service` with `email:send`). The audience of a service account must never appear in `JwtSettings:Audience` or `AdditionalAudiences`: the start is refused, because such a token would be accepted by this API as a bearer token |
| `Identity:Relay:TargetAudiences` | `communication -> communication-service` | Subscriber name to the audience requested for the relay's service token (a subscriber without an entry gets its own name). The subscriber name stays the key of `ServiceEndpoints:Services` and `ServiceTransport:Subscriptions` |
| `ServiceEndpoints:Services:<name>` | none | Service name to base URL; the only place where service addresses live |
| `ServiceHost:InboxEnabled` / `InboxPolicy` | `false` / `perm:identity:events:receive` | Identity receives no events, so `/internal/events` is not mapped (the ServiceKit RC pin supports this); the policy additionally keeps ordinary user tokens (audience `identity`) out, because nobody holds that permission |
| `ServiceTransport:Mode` | `Http` | `Http` or `InMemory` (single-process tests only) |
| `ServiceTransport:Subscriptions` | `email.mail-requested -> communication` | Event type to subscriber services |
| `BieberWorks:Auth:MailQueue:Durable` | `true` | Auth mail jobs are stored in the Auth database (not in memory) and survive a process kill |
| `ServiceHost:ReverseProxy:Enabled` / `KnownProxies` / `KnownNetworks` / `ForwardedHeaders` | `false` / none / none / `For`, `Proto`, `Host` | Frontends or proxies (addresses / CIDR networks) that may tell identity the browser's address, scheme and host in `X-Forwarded-*` (ServiceKit transport profile, see its `55-transport-tls.md`). Sign-in throttling, the session list and cookie security use them. Without the profile the headers are ignored and every user behind a frontend shares the frontend's address (one attacker can then throttle everybody). Enabled without a proxy or network stops the start. Behind a frontend that only forwards the address, list `For` only. **Replaces `Identity:ForwardedHeaders:*` (removed)** |
| `ServiceHost:Https:*` | off | TLS in Kestrel from PEM files (Docker secrets), reloaded without a restart; see the ServiceKit transport profiles |
| `Oidc:Issuer` | none (**required**) | Public address of the OpenID Connect provider (absolute https URL in normalized form, no query or fragment; a host-only issuer needs the trailing slash, e.g. `https://idp.example.org/`, because the provider publishes `iss` and discovery that way and resource servers compare exactly), never derived from a request. **https is required in every environment, Development included** (the issuer is only a string; a local http listener is fine). It must equal `JwtSettings:Issuer`, the session cookie must be `SameSite=Lax` (and `Always` secure outside Development), and the host refuses to start without `ServiceHost:ReverseProxy` or `ServiceHost:Https` outside Development |
| `Oidc:EncryptionKeyFile` | none (required outside Development) | Docker secret: file with a 256-bit key (Base64, 32 bytes). It encrypts authorization codes and refresh tokens in the database, so it must be persistent and identical on all instances; losing it invalidates them. Development without a file uses a random key that dies with the process |
| `Oidc:DefaultAudiences` | `["identity"]` | `aud` of access tokens for clients without own audiences. A resource server rejects a token without `aud`, so at least one is required |
| `Oidc:Clients` | none | Clients seeded at every start (`ClientId`, `Type`, `ClientSecretFile` for a confidential client, `RedirectUris`, `ConsentType` `Implicit` or `Explicit`, `Scopes`, `Audiences`). Configured clients are read-only for the admin API; clients created through the API are never touched by the seeder |
| `Oidc:ConsentPath` | `/connect/endsession`, `/connect/logout`, `/signed-out` | End-session endpoint, its confirmation page and the page after a sign-out |
| `/connect/consent` | Local path of the consent page. The default is the page of `Oidc.Consent.UI.Blazor.MudBlazor`, which this host serves; another path needs a page of the host's own at that path (and an entry in `IdentityPageAllowList` if it comes from a package) |
| `BieberWorks:Auth:Cookie:SameSite` / `SecurePolicy` | `Lax` / `Always` | Image default (the Auth default is `Strict` / `SameAsRequest`): the browser must send the session cookie when it is redirected from a client application to the authorize endpoint |
| `BieberWorks:Auth:SignIn:FailureBrake:*` | `Enabled=false` | Optional brake for failed sign-ins per client address (delay, concurrency caps). Off in the image; read the activation checklist in [operations](50-operations.md#sign-in-brake-per-client-address) before switching it on |
| `Identity:DataProtection:KeyRingPath` | `/var/lib/identity/keys` | Directory of the persistent data protection key ring (see [operations](50-operations.md#data-protection-key-ring)). Required outside Development: without it the start is refused. Mount a volume here |
| `App:PublicBaseUrl` | none | Base URL of the frontend for links in mails |
| `Auth:Bootstrap:*` | off | Seed an administrator |
| `ServiceTransport:Postgres:*Retention` | 7 d delivered / 30 d inbox / 30 d dead (identity default, ServiceKit: 90 d) | Retention of outbox and inbox rows (see the ServiceKit docs); mail payloads are emptied on delivery |
| `BieberWorks:Auth:MailQueue:DeadPayloadRetention` | `7.00:00:00` | Dead mail jobs lose their clear-text token payload after this time |

## Sign-in UI

The host serves the interactive sign-in pages of `BieberWorks.SDK.Auth.UI.Blazor.MudBlazor` (Blazor Server) next to the REST API,
and nothing else of the UI packages:

| Path | Page |
| --- | --- |
| `/` | Start page: a sign-in link, or the name of the signed-in user |
| `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/confirm-email`, `/auth/access-denied` | Sign-in, registration and password pages |
| `/connect/consent` | Consent page of the OpenID Connect provider (clients with `ConsentType` `Explicit`); a plain HTML form that posts the decision to `/connect/authorize` |

Every other route that the referenced packages make routable (profile, account, security, avatar, user and role management,
registration settings, `/auth/logout`) and every unknown path answers with a real **404**; there is no `/admin`. The list is an
allowlist in the host (`IdentityPageAllowList`), so a page that an Auth update adds stays closed until it is listed.
The app bar offers the dark mode switch and the language switch; the user entry shows the signed-in user with a sign-out button
and has no account link. The dark mode switch writes the cookie `bw.theme` (registered as a necessary cookie) after the first
click; besides that the host sets only the session cookie `bw.auth`, the culture cookie after a language change and the
antiforgery cookie.

## OpenID Connect provider

The image is an OpenID Connect provider (module `BieberWorks.SDK.Oidc`, endpoints under `/connect/*`, discovery and key set under
`/.well-known/*`). Sign-in happens on the pages above; clients with explicit consent additionally show the consent page once per
user, client and scope set. Tokens are signed with RS256.

* **Client administration is an API, not a UI.** `GET/POST/PUT/DELETE /api/v1/oidc/clients`, `POST .../{clientId}/secret/rotate`
  and `GET /api/v1/oidc/scopes` accept **bearer tokens only** (a session cookie is answered with 401) and need the permission
  `oidc:clients:manage`: the access token must carry the scope `perm` and its user the permission (the administrator role has it).
  Service-account tokens (`/api/v1/auth/service-token`) are not accepted. Responses are `Cache-Control: no-store`; a client secret
  appears in the answer of create and rotate only. The routes are not part of the OpenAPI document and are meant for the internal
  network (see [operations](50-operations.md#exposure)). The management UI (`Oidc.Admin.*`) is not part of this image.
* **Audit events are not persisted.** The provider publishes events for client creation, change, secret rotation, deletion and
  consent decisions, but this host has no audit module, so they are only logged. Persistence waits for a central audit service.
* **Sign-out and end-session** are available (see [operations](50-operations.md#sign-out-and-end-session)). Defaults: `Oidc:EndSessionConfirmPath=/connect/logout`, `Oidc:EndSessionCompletedPath=/signed-out`, `Oidc:EndSession:RevokeSessionTokens=true`. Relying parties must verify `auth_time`; all instances need the same Data Protection key ring.

The host runs as **one instance**: the sign-in ticket store and the Blazor circuits live in process memory (see
[operations](50-operations.md#one-instance-per-database)).

## Logging and log rotation

The image sets `Microsoft.EntityFrameworkCore.Database.Command` to `Warning`; otherwise every SQL statement is logged
at `Information` (around 90 % of all lines). Raise it temporarily with
`Logging__LogLevel__Microsoft.EntityFrameworkCore.Database.Command=Information` when debugging.

The service writes to the console only. Limit the container log size in your runtime, for example in Compose:
`logging: { driver: json-file, options: { max-size: "10m", max-file: "5" } }`.

## User events

| Key | Default | Meaning |
| --- | --- | --- |
| `Identity:UserEvents:Enabled` | `true` | Capture account changes and publish `identity.user-created` / `-updated` / `-deleted`. Off: nothing is captured or queued |
| `Identity:UserEvents:IncludeEmail` | `false` | Put the e-mail address into the event profile. Names, roles and acting user ids are never part of an event |
| `ServiceTransport:Subscriptions` | `email.mail-requested` only | Add the event types a service wants, for example `"identity.user-deleted": [ "billing" ]` (in `appsettings` or a mounted configuration file: event names contain dots and dashes, which environment variable names usually cannot). The subscriber needs an entry in `ServiceEndpoints:Services` |
| `BieberWorks:Auth:LifecycleEvents:PollInterval` / `BatchSize` / `MaxAttempts` / `RetentionPeriod` | `00:00:05` / `50` / `120` / `3.00:00:00` | Dispatcher and retention of the Auth outbox that carries the events. `Enabled` and `IncludeEmail` there follow `Identity:UserEvents` unless set explicitly. `ApplyAuthDefaults` requires an `IConfigurationBuilder` (`ConfigurationManager` or `WebApplicationBuilder.Configuration`); with a plain `ConfigurationRoot` it throws an `InvalidOperationException` |

The catalog of events, the payload and the rules for receivers are in [User events](60-user-events.md); retention and dead-letters in [operations](50-operations.md#user-events).

## Operations settings

| Key | Default | Meaning |
| --- | --- | --- |
| `Database:ConnectTimeout` / `CommandTimeout` | `00:00:03` / `00:00:10` | Added to `AuthDb`, `ServiceDb` and `OidcDb` unless the connection string sets `Timeout` / `Command Timeout` itself |
| `Database:RetryCount` / `MaxRetryDelay` | `1` / `00:00:01` | Retry budget of failed database calls (the Auth module alone retries 6 times for over a minute) |
| `Database:RefuseNewerSchema` | `false` | Stop the start when the database has migrations this build does not know (rollback against a newer schema); otherwise it is logged as an error |
| `RateLimiting:Policies:<key>:PermitLimit` / `Window` / `LockoutDuration` | Auth defaults | Override a rate limit, see [operations](50-operations.md) |
| `RateLimiting:DefaultRetryAfter` | `00:01:00` | `Retry-After` of a 429 when the limiter could not tell the wait |
| `OpenApi:Enabled` / `RequireAuthorization` | `true` / `false` | Serve `/openapi/v1.json`, optionally only to authenticated callers |
| `ServiceHost:InfoRequiresAuthorization` | `false` | Same for `/info` |
| `ServiceHost:Metrics:*` | off | Opt-in Prometheus endpoint (token or explicit `AllowAnonymous`). Use it **or** OTLP metric export, not both |
| `Observability:Enabled` | `false` | Master switch for OpenTelemetry (traces, metrics, logs over OTLP). Off: no provider, no exporter, nothing changes. See [Telemetry](50-operations.md#telemetry) |
| `Observability:Otlp:*` | none | `Endpoint` (for example `http://collector:4318`), `Protocol` (`http/protobuf` default, `grpc`), `Headers` (secret, environment variable or file only), `Timeout`; per-signal overrides under `Traces`, `Metrics`, `Logs` |
| `Observability:Signals:*` | all `true` | Switch `Traces`, `Metrics` or `Logs` off individually (effective once `Enabled` is set) |
