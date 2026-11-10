# Standalone operation and contract suite

The identity service starts, becomes healthy and passes its own contract suite **without the communication service**. It needs
PostgreSQL and the signing key file, nothing else. The subscriber address (`ServiceEndpoints:Services:communication`) is optional.

```powershell
powershell -File deploy/standalone/run-standalone.ps1              # exact pins from the repository
powershell -File deploy/standalone/run-standalone.ps1 -LocalFeed   # unreleased -dev packages from the local feed
```

The stack (`deploy/standalone/docker-compose.yml`, profile `standalone`) consists of the service (environment `Production`, so an
inline signing key would stop the start), PostgreSQL and an **event sink** (`bw-test/servicekit-testdoubles`, label
`bw.purpose=test-only`, built from the `SDK-ServiceKit` repository) that plays the subscriber: it validates the service token
of the sender exactly like the real subscriber (audience `communication-service`, permission `email:send`) and records the envelopes.
The stack runs in an `internal` network, the suite runs inside it, and the script checks mechanically that no other business
service is part of the stack. The signing key is generated into the gitignored `deploy/standalone/secrets` folder and mounted as a Docker secret.

What the suite proves (`deploy/standalone/suite/suite.ps1`):

* `/health`, `/info` (service, commit, real package versions), discovery document, JWKS (EC P-256, kid, no private part).
* The seeded admin signs in; the access token is ES256 with a published `kid`, the expected issuer, audiences and `perm` claims,
  and a lifetime of at most 60 minutes.
* A registration publishes exactly one `email.mail-requested` envelope (event type, source service, message id, schema version,
  addressed payload) to the subscriber.
* Subscriber outage: the registration still answers 200, `/health` stays 200, the event is held and delivered at-least-once (the receiver deduplicates by event id)
  after the subscriber is back.
* Restart: the key is read from the secret file again, sign-in works, the JWKS keeps the `kid`.
* Start without any subscriber address: the service is alive, healthy and registration works.
* The published OpenAPI paths equal the committed snapshot (`suite/openapi.paths.txt`).

The token expectations are also checked by `IssuerConformance` (package `BieberWorks.SDK.ServiceKit.Testing`) in the unit tests
against the real service; the mock issuer used by the communication standalone suite passes the same checks.
