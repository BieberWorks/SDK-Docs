# Operations

Settings for running service hosts in production. All keys live under `ServiceHost` or `ServiceTransport` and can be
set as environment variables (`ServiceHost__HealthCheckTimeout=00:00:01`) or as secret files.

## Database outage

* Connections to the transport database open with a `Timeout` of 3 s and run commands with a `Command Timeout` of 10 s
  (`ServiceTransport:Postgres:ConnectTimeout`, `CommandTimeout`). A value written in the connection string wins.
* **Fail-fast circuit per database server** (`ServiceTransport:Circuit`, on by default). The first connection to a server
  that fails for a connectivity reason (refused, unreachable, connect timeout, broken socket; not wrong credentials and not
  a slow statement) opens the circuit for `BreakDuration` (default 5 s). While it is open every new connection attempt to
  that server fails at once with `DependencyUnavailableException`, without network traffic, and the idle connections of
  every pool of that server are dropped. After the break one caller probes the server; its success closes the circuit,
  its failure opens it again. The circuit covers the transport stores and every EF Core `DbContext` of the host (an
  interceptor is added to all contexts automatically by `AddServiceKitPostgresStores`), so a request with several database
  calls and an EF retry costs at most one connect timeout instead of one per call and attempt. A connect that hung through
  the whole outage and fails after the recovery does not reopen the circuit.
* Measured with a database that accepts connections but never answers (how a stopped container looks from a Docker
  network, where the name lookup alone takes about 3.7 s): the request that hits the outage first answers after one
  connect timeout (3.0 s; 0.1 s when it only finds broken pooled connections), every further request within milliseconds,
  `/health` within 1.5 s. Without the circuit every request waited 3 s or more (up to 12.5 s in the RC2 acceptance with
  several database calls per request).
* A request that fails because the database or another network dependency is unreachable (open circuit, transient
  `DbException`, timeout, socket error) is answered `503` with `Retry-After` (`ServiceHost:DependencyRetryAfter`, default
  5 s, matching the default break) instead of hanging or returning a bare 500. Logic errors and constraint violations stay
  500. In `Development` the developer exception page answers first.
* `/health` bounds every check at `ServiceHost:HealthCheckTimeout` (default 1.5 s), also a check that ignores its
  cancellation token (for example a connect stuck in a name lookup); the abandoned check finishes in the background. A
  check that does not finish in time reports its failure status, so an orchestrator probe with a 3 s timeout sees a clean
  503. The outbox check reports `Unhealthy` at once, without a query, while the circuit is open. Its backlog numbers are
  cached for `ServiceTransport:Postgres:HealthCacheDuration` (default 5 s) only while the database answers: a failed
  query is never cached, and an open circuit overrides the cache. Without any traffic a fresh outage shows up at the
  latest after the cache duration plus the check timeout.
* **What the circuit sees.** Only connections opened through EF Core (every `DbContext` of the host) and through the
  transport stores are observed, so `outcomeUnknown` reflects only those connections. A connection opened by other code
  (for example a raw `NpgsqlConnection` in a handler) is neither guarded nor counted. Only a socket error, an I/O error or
  a physical connect timeout opens the circuit; a database error (for example `53300` too many connections) and an
  exhausted connection pool are not outages and leave it closed.
* **Network loss with a filled pool.** If the network drops while pooled connections exist, the first statements on them
  wait until the command timeout before the broken socket is detected; the circuit opens only then. Add TCP keepalive to the
  connection string (`Keepalive=10`, `TCP Keepalive=true`, `TCP Keepalive Time`/`TCP Keepalive Interval`) so dead
  connections are detected earlier.
* **Idempotency.** A `503` is not proof that nothing happened. A request that fails fast before it opened any connection
  changed nothing: its body says `outcomeUnknown: false`, and it can be repeated. When a write request (anything but
  GET/HEAD/OPTIONS) had already opened a connection, or timed out, or lost its connection (socket or I/O error), or met a
  transient database error, the database may have committed part or all of it: the host logs `Timeout during write
  request` with the exception and sets `outcomeUnknown: true`. The circuit itself never repeats a call: it only refuses
  new connections, so no write runs twice because of it. Only requests that are idempotent may be repeated blindly: for
  example the mail queue submission with a `messageId` (a repeat is ignored) and event delivery to `/internal/events` (the
  inbox deduplicates). Non-idempotent calls such as a registration may produce a duplicate (for example a 409) when
  repeated after an unknown outcome; the client must check the state first.
* The outbox keeps events while a subscriber is down (time budget `ServiceTransport:MaxRetryAge`, default 3 days).
* Set `ServiceTransport:Circuit:Enabled=false` to turn the circuit off (each request then waits for its own connect
  timeouts again).

## Metrics (`/metrics`, opt-in)

Off by default. Enable with `ServiceHost:Metrics:Enabled=true`. The host refuses to start with the endpoint enabled unless
you either set `ServiceHost:Metrics:BearerToken` (supply it as a secret file such as
`/run/secrets/ServiceHost__Metrics__BearerToken`; scrapers send `Authorization: Bearer ...`) or explicitly set
`ServiceHost:Metrics:AllowAnonymous=true` for a port that is only reachable inside a private network.

The Prometheus text format is rendered by the host itself (no extra package) from the meters listed in
`ServiceHost:Metrics:Meters` (default: `BieberWorks.*`, ASP.NET Core hosting and Kestrel, `System.Runtime`; a configured list replaces the default). Transport metrics
on meter `BieberWorks.SDK.ServiceKit`:

| Metric | Type | Meaning |
| --- | --- | --- |
| `servicekit_outbox_enqueued_total`, `_delivered_total`, `_retried_total`, `_deferred_total`, `_dead_lettered_total` | counter | outbox flow by `event_type`; `dead_lettered` is the alarm counter |
| `servicekit_outbox_delivery_duration_seconds` | histogram | one delivery attempt (`result` = ok, deferred, failed) |
| `servicekit_outbox_delivery_latency_seconds` | histogram | enqueue to successful delivery |
| `servicekit_outbox_backlog` | gauge | entries by `state` (pending, blocked, dead), refreshed every `ServiceTransport:Postgres:MetricsInterval` (15 s) |
| `servicekit_outbox_oldest_pending_age_seconds` | gauge | age of the oldest undelivered entry |
| `servicekit_inbox_received_total`, `servicekit_inbox_handle_duration_seconds` | counter, histogram | received events by `outcome` (processed, duplicate, failed) |

Gauges read cached numbers; a scrape never queries the database. The number of series is capped at 2000; the first
dropped measurement is logged and further drops are counted in `servicekit_metrics_dropped_series_total`. The label
`event_type` only carries types this service produces or handles; an unknown type received from outside is counted as
`other` and is cut to 64 characters in the log. `/health` reads a snapshot of the outbox backlog that is at most
`ServiceTransport:Postgres:HealthCacheDuration` (default 5 s) old, so repeated probes cost one query per interval.

## Tracing and correlation

Every event carries a W3C `traceparent` and a correlation id. When the producer runs inside a request the ambient trace is
used; a background worker (for example the mail queue of a service) gets a fresh trace id. The outbox stores both
(`trace_parent`, `correlation_id`), the relay continues the stored trace in its `servicekit.publish` span and sends the
`traceparent` header, and the receiving dispatcher continues it in `servicekit.handle`. Both sides log `TraceId`,
`CorrelationId` and `MessageId` in a logging scope (enable scopes in the console logger to see them). Span export needs an
OpenTelemetry SDK in the host; the activity source is `BieberWorks.SDK.ServiceKit`.

## Signing key rotation and removal

Consumers validate tokens against the issuer's JWKS and cache it (Microsoft.IdentityModel `ConfigurationManager`).

* `ServiceHost:Jwt:AutomaticRefreshInterval` (default 10 minutes, minimum 5 minutes) is the unconditional reload interval.
  Once it has passed (plus a random jitter of up to 5 %), the next request starts a reload in the background and is still
  validated with the cached keys; the requests after the reload use the new key set.
* `ServiceHost:Jwt:RefreshInterval` (default 30 s, minimum 1 s) is the minimum delay between forced reloads. A token whose
  `kid` is not in the cached key set forces one, so a newly published key is accepted within seconds.
* Values below the minimums stop the start with an `OptionsValidationException` that names the setting (the library itself
  would fail with `IDX10107`/`IDX10108`).
* The host turns off the library's "last known good configuration" fallback (`UseLastKnownGoodConfiguration=false`). With
  the fallback, a token signed by a removed key was validated again against an older key set that had validated a token
  before, for up to one hour (`LastKnownGoodLifetime`), regardless of the refresh interval. Without it the key set that was
  loaded last is the only one that counts. An unreachable issuer does not change this: a failed reload keeps the cached
  key set in use.

A key removed from the JWKS is therefore rejected at the latest after `AutomaticRefreshInterval` + 5 % + the time until the
next request (about 10.5 minutes with the default). Rotation:

1. Add the new key next to the old one in the issuer and publish both (the JWKS lists all configured keys).
2. Switch `ActiveKid` to the new key. New tokens are signed with it; consumers pick it up on the first unknown `kid`.
3. Keep the old public key for at least the access token lifetime (default 15 minutes) plus `AutomaticRefreshInterval`.
4. Remove the old key. Consumers stop accepting it within `AutomaticRefreshInterval` (see above).

Remove the old key only after `AutomaticRefreshInterval` (plus jitter) and the maximum token lifetime have passed since the
new key became `ActiveKid`; removing it earlier rejects tokens that are still valid.

The upper bound above applies while the issuer is reachable. If the issuer is down, reloads fail and the last loaded key set
stays in use for as long as the outage lasts, so a removed key keeps being accepted until a reload succeeds.

On a key compromise remove the key at once and restart the consumers, which reload the key set on start; otherwise the key
stays valid until the next reload. Lower `AutomaticRefreshInterval` towards 5 minutes if that window is too long, at the cost
of more JWKS requests.

## Start-up checks and exposure

* An empty `ServiceHost:Jwt:Authority` (and no `MetadataAddress`) stops the start in `Production`, because every token would
  be rejected without a hint; elsewhere it is logged as a warning. `ServiceHost:Jwt:AllowEmptyAuthority=true` opts out.
* `/info` lists version, commit and package versions and is anonymous by default. Set
  `ServiceHost:InfoRequiresAuthorization=true` (and optionally `InfoPolicy`) when the service can be reached from outside, or
  keep the service on an internal network behind a reverse proxy that only exposes the public API.

## Crash recovery and memory

A claimed outbox entry is leased for `ServiceTransport:Postgres:LeaseDuration` (default 60 s). After a hard kill the entry is
delivered again once the lease expired, so the wait after a crash is at most that value; lowering it shortens the wait but
risks duplicate delivery when a delivery takes longer (receivers deduplicate by message id). Give containers a memory
limit (for example `mem_limit: 512m` in Compose or a Kubernetes `limits.memory`); a service host settles around 150 to
200 MiB, and the limit turns a leak into a restart instead of a host problem.
