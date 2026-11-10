# Standalone operation and contract suite

The communication service starts, becomes healthy and passes its own contract suite **without any other business service**.
It depends on the contract of a token issuer (OIDC discovery plus JWKS, permission `email:send`), not on the identity
implementation.

```powershell
powershell -File deploy/standalone/run-standalone.ps1              # exact pins from the repository
powershell -File deploy/standalone/run-standalone.ps1 -LocalFeed   # unreleased -dev packages from the local feed
```

The stack (`deploy/standalone/docker-compose.yml`, profile `standalone`) consists of the service, PostgreSQL, Mailpit and the
**mock issuer** (`bw-test/servicekit-testdoubles`, label `bw.purpose=test-only`, built from the `SDK-ServiceKit` repository). It
runs in an `internal` network without a route to the outside; the suite runs inside that network. The script checks
mechanically that the stack contains no other business service.

What the suite proves (`deploy/standalone/suite/suite.ps1`):

* Start **before** the issuer exists: the service is alive, `/health` reports the check `jwks` as `Degraded`, every token gets 401.
  When the issuer appears the keys are loaded without a restart.
* Token with `email:send` is accepted (202); without it 403; wrong audience, tampered signature, no token 401.
* Repeating the same submission or the same event id does not queue a second mail (at-least-once delivery: a crash or lease expiry during sending can still cause a rare duplicate).
* `POST /internal/events` requires `email:send`; the second delivery of an event id is reported as `Duplicate`.
* Key rotation: a token signed with a newly published key is accepted within the configured `RefreshInterval`; the old key keeps working.
* Mail server outage: submissions are accepted and the mail is delivered at-least-once after the server is back.
* Restart of the service and of the database: keys are loaded again, submissions are accepted.
* The published OpenAPI paths equal the committed snapshot (`suite/openapi.paths.txt`).

The mock issuer refuses to start outside `Development`/`Testing`, logs a warning at start and exposes `testOnly` in `/info`.
It must never be used in a production stack. The same token expectations are checked against the mock **and** the real identity
service by `IssuerConformance` (package `BieberWorks.SDK.ServiceKit.Testing`), which keeps the double from drifting.
