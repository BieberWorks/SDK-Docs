# Test doubles for standalone service tests

`BieberWorks.SDK.ServiceKit.Testing` lets a service be started and tested **without the other services**. It is a test
package: never reference it from a production host and never ship it in a service image.

| Type | Purpose |
|---|---|
| `MockIssuer` / `MapMockIssuer` | Token issuer double: OIDC discovery, JWKS (ES256, public part only), `POST /token` (free `sub`, `aud`, `perm`, lifetime, `kid`), key rotation (`POST /admin/keys`, `DELETE /admin/keys/{kid}`) |
| `AddEventSink` / `MapEventSink` | Subscriber double for publishing services: the real inbox endpoint with token validation and the `perm:email:send` policy, records envelopes under `GET /received` |
| `IssuerConformance` | The contract check every token issuer must pass: discovery fields, JWKS shape (EC P-256, `kid`, no private part), token header (ES256, published `kid`), claims (`iss`, `aud`, `sub`, `perm`, lifetime derived from `nbf`/`iat`) and signature against the published keys |

`IssuerConformance` runs against the mock issuer (ServiceKit tests) **and** against the real identity service (Identity tests).
That is what keeps the double from drifting away from the real thing: a behaviour the mock accepts but identity never produces
shows up as a failing check on one side.

The container entry point `tools/BieberWorks.SDK.ServiceKit.TestDoubles` (modes `issuer` and `sink`) is built into the image
`bw-test/servicekit-testdoubles` (label `bw.purpose=test-only`):

```powershell
docker build -f tools/BieberWorks.SDK.ServiceKit.TestDoubles/Dockerfile -t bw-test/servicekit-testdoubles .
```

It refuses to start unless `ASPNETCORE_ENVIRONMENT` is `Development` or `Testing`, logs a warning at start and reports
`testOnly` in `/info`. Do not publish the image into a production registry namespace and do not reference it from production
compose files. The standalone stacks of `SDK-Identity` and `SDK-Communication` use it.

## Host behaviour the suites rely on

* `/health` contains the check `jwks`: `Degraded` until the signing keys of the issuer were loaded once, `Healthy` afterwards, also
  while the issuer is down (the cached keys keep working). A service that starts before its issuer is alive and rejects every token (401)
  until the keys are loaded; it needs no restart.
* `ServiceHost:Jwt:RefreshInterval` (default 30 s) bounds how long a freshly rotated key stays unknown to a running service.
