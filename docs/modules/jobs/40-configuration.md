# Configuration

## `Jobs:Dispatcher` (`JobDispatcherOptions`)

| Option | Default | Meaning |
|---|---|---|
| `PollInterval` | 5s | Dispatcher poll frequency. |
| `BatchSize` | 20 | Max definitions claimed per poll tick. |
| `LeaseDuration` | 5 min | Timeout guard for a claimed execution. |
| `LeaseReaperInterval` | 1 min | How often the lease reaper scans for expired leases. |
| `UseExternalScheduler` | `false` | When `true`, disables the default dispatcher/lease-reaper hosted services entirely — an externally registered `IJobScheduler`/`IJobStore` provider takes over. |

## `Jobs:Retry` (`JobRetryOptions`)

| Option | Default | Meaning |
|---|---|---|
| `DefaultMaxAttempts` | 5 | Default max attempts, overridable per `JobDefinition`. |
| `DefaultStrategy` | `Exponential` | Default backoff strategy. |
| `DefaultBaseDelay` | 30s | Default backoff base delay. |
| `MaxBackoffCap` | 1h | Hard cap on computed backoff delay. |

## `Jobs:Outbox` (lifecycle-event dispatcher, `OutboxOptions`)

| Option | Default | Meaning |
|---|---|---|
| `Enabled` | `true` | `false` registers no outbox dispatcher for `JobsDbContext`; lifecycle events then stay in `jobs.outbox_messages`. |
| any `OutboxOptions` property | Persistence default | Bound onto the options of the Jobs dispatcher only, e.g. `PollInterval` (`00:00:10`), `BatchSize` (50), `MaxAttempts` (10), `BaseRetryDelay`, `MaxRetryDelay`, `LeaseDuration`, `RetentionPeriod` (7 days), `DeadLetterRetentionPeriod`. TimeSpan values use the `hh:mm:ss` format, as in `Jobs:Dispatcher`. |

Independent of `UseExternalScheduler`. See [Scheduling](20-scheduling.md#lifecycle-event-delivery).

## Connection string

Resolved from `JobsDb`, falling back to `DefaultConnection` (same convention as other modules).

## Logging — EventId range

All `[LoggerMessage]` delegates in `BieberWorks.SDK.Jobs` use the fixed range **6000–6099**.
This is a per-repo convention (no SDK-wide registry exists yet); see the implementation plan,
Abschnitt 9/12.0, for the precedent this sets for future modules.

## Provider-swap seam

All core `IJobScheduler`/`IJobQueryService`/`IJobStore`/`ICronScheduleCalculator`/
`IJobRetryPolicy` registrations in `JobsModule` use `TryAdd*`. A host that wants an alternative
provider (e.g. a future `Jobs.Quartz` adapter) registers its own implementation **before**
`JobsModule.RegisterServices` runs; the `TryAdd*` calls then no-op and the external provider
wins. Combine with `JobDispatcherOptions.UseExternalScheduler = true` to also suppress the
default dispatcher/lease-reaper hosted services.
