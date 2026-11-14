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
  500. In `Development` the developer exception page sits inside this middleware and would answer with 500; the host registers an
  `IDeveloperPageExceptionFilter` that gives the same 503 answer there.
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
`ServiceHost:Metrics:Meters` (default: `BieberWorks.*`, ASP.NET Core hosting and Kestrel, `System.Runtime`; a configured list replaces the default).

**Names are the OpenTelemetry names.** One component translates every instrument exactly as the OTLP path (collector or
Prometheus OTLP receiver) does, so a series has the same name whether it is scraped here or pushed over OTLP: `.` becomes
`_`, the unit becomes a suffix (`s` to `_seconds`, `By` to `_bytes`, a gauge with unit `1` to `_ratio`; `{event}`
annotations add nothing), counters get `_total`, up-down counters are gauges. Histograms use the bucket bounds the instrument
declares (bucket advice); an instrument without advice gets the OpenTelemetry default bounds, like on the OTLP path. The
service identity is rendered as `target_info` (`service_name`, `service_version`, `service_namespace`=`bieberworks`,
`service_instance_id`, `deployment_environment_name`), the same resource attributes the OTLP path attaches. Lines end with
`\n`. A test compares the families, types and bucket bounds with the OpenTelemetry Prometheus exporter. One known difference:
the .NET exporter does not add `_ratio` to a gauge with unit `1`, the OTel specification and the Prometheus OTLP translation
do, and so does this endpoint (no ServiceKit instrument uses unit `1`).

Transport metrics on meter `BieberWorks.SDK.ServiceKit`, instruments `bieberworks.servicekit.*` (naming convention of the SDK):

| Metric | Type | Meaning |
| --- | --- | --- |
| `bieberworks_servicekit_outbox_enqueued_total`, `_delivered_total`, `_retried_total`, `_deferred_total`, `_dead_lettered_total` | counter | outbox flow by `event_type`; `dead_lettered` is the alarm counter |
| `bieberworks_servicekit_outbox_delivery_duration_seconds` | histogram | one delivery attempt (`result` = ok, deferred, failed); bounds 5 ms to 60 s |
| `bieberworks_servicekit_outbox_delivery_latency_seconds` | histogram | enqueue to successful delivery; bounds 1 s to 24 h |
| `bieberworks_servicekit_outbox_backlog` | gauge | entries by `state` (pending, blocked, dead), refreshed every `ServiceTransport:Postgres:MetricsInterval` (15 s) |
| `bieberworks_servicekit_outbox_oldest_pending_age_seconds` | gauge | age of the oldest undelivered entry |
| `bieberworks_servicekit_inbox_received_total` | counter | received events by `outcome` (processed, duplicate, failed) |
| `bieberworks_servicekit_inbox_handle_duration_seconds` | histogram | handling of a received event by `outcome`; bounds 5 ms to 60 s |
| `bieberworks_servicekit_events_unhandled_total` | counter | events without a handler (`event_type` is always `other`) |
| `bieberworks_servicekit_dependency_unavailable_total` | counter | requests answered 503 because a dependency was unreachable, by `reason` (`fail_fast` circuit open, `timeout` write timed out, `unavailable` other connectivity failure) |
| `bieberworks_servicekit_metrics_dropped_series_total` | counter | only on `/metrics`: measurements dropped at the series cap |

The backlog gauges and the polling behind them exist only in a host that delivers events (`AddServiceKitOutboxRelay`). A
service that merely holds the tables, such as one that only receives events, exposes no backlog series instead of a
constant zero.

Gauges read cached numbers; a scrape never queries the database. The number of series is capped at 2000; the first
dropped measurement is logged and further drops are counted in `bieberworks_servicekit_metrics_dropped_series_total`. The label
`event_type` only carries types this service produces or handles; an unknown type received from outside is counted as
`other` and is cut to 64 characters in the log. `/health` reads a snapshot of the outbox backlog that is at most
`ServiceTransport:Postgres:HealthCacheDuration` (default 5 s) old, so repeated probes cost one query per interval.

### Migration from 0.1.x (telemetry changes)

Instruments and scrape names changed; update dashboards and alerts.

| Before | After |
| --- | --- |
| `servicekit_outbox_*`, `servicekit_inbox_*`, `servicekit_events_unhandled_total` | `bieberworks_servicekit_outbox_*`, `bieberworks_servicekit_inbox_*`, `bieberworks_servicekit_events_unhandled_total` |
| `servicekit_metrics_dropped_series_total` | `bieberworks_servicekit_metrics_dropped_series_total` |
| `dotnet_process_memory_working_set`, `dotnet_gc_last_collection_*_size`, `dotnet_gc_heap_total_allocated_total`, `dotnet_jit_compiled_il_size_total` | `..._bytes` / `dotnet_gc_heap_total_allocated_bytes_total` / `dotnet_jit_compiled_il_size_bytes_total` |
| histogram bounds: one fixed list (5 ms to 60 s) for all | per instrument; histograms without advice use the OpenTelemetry default bounds |

New: `target_info`, `bieberworks_servicekit_dependency_unavailable_total`. The `servicekit.outbox.backlog` gauges are gone
from hosts without an outbox relay.

### One metric path per service

`ServiceHost:Metrics` (pull, this endpoint) and the OTLP push of SDK-Observability (`Observability:*` or the standard
`OTEL_EXPORTER_OTLP_*` variables) deliver the same series under the same names. Use one of them per service; both at once
report everything twice. The host logs a warning at start when the pull endpoint is enabled and metrics are also exported
over OTLP. `ServiceHost:ServiceName` and `ServiceVersion` stay the single source of the service identity for both paths.
The warning reads `Observability:Enabled`, `Observability:Signals:Metrics`, `Observability:Otlp:Endpoint`,
`Observability:Otlp:Metrics:Endpoint` and the variables `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT`,
`OTEL_SDK_DISABLED`, `OTEL_METRICS_EXPORTER` as plain configuration; the package is not referenced.

### Probe endpoints and route guard

`ServiceHostPaths` names the fixed paths: `/health`, `/alive`, `/info` (`ProbePaths`), `/internal/events` and the default
`/metrics`. Orchestrators and scrapers call them every few seconds, so tracing should skip them (SDK-Observability does by
default). Mapping one of these paths a second time (for example `MapBieberWorksHealthEndpoints` of SDK-Observability next
to `MapBieberWorksServiceHost`) would make every request fail with an ambiguous match (HTTP 500). The host refuses the
start with an `InvalidOperationException` that names both endpoints, whatever the order of the mapping calls; an endpoint
for another HTTP method on the same path is no collision.

## Tracing and correlation

Every event carries a W3C `traceparent` and a correlation id. When the producer runs inside a request the ambient trace is
used; a background worker (for example the mail queue of a service) gets a fresh trace id. The outbox stores both
(`trace_parent`, `correlation_id`), the relay continues the stored trace in its `servicekit.publish` span and sends the
`traceparent` header, and the receiving dispatcher continues it in `servicekit.handle`. Both sides log `TraceId`,
`CorrelationId` and `MessageId` in a logging scope (enable scopes in the console logger to see them). Span export needs an
OpenTelemetry SDK in the host; the activity source is `BieberWorks.SDK.ServiceKit`.

Spans carry the messaging attributes `messaging.system` (`bieberworks.servicekit`), `messaging.operation.type`
(`publish` or `process`), `messaging.destination.name` (event type) and `messaging.message.id`, plus `result`
(publish: ok, deferred, failed) or `outcome` (handle: processed, duplicate, failed). A delivery that is not `ok` and a
handler that throws set the span status to Error with `error.type`; the exception message is never recorded because it can
contain personal data. `servicekit.handle` is a child of the active span of the same trace (the inbox request span, which
continues the sender's trace); without an active span it continues the trace stored in the envelope; an active span of
another trace is linked, not used as parent.

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
