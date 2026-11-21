# Scheduling, Retry, Dead-Lettering

## Cron

Strict 5-field (minute resolution) cron via [Cronos](https://github.com/HangfireIO/Cronos),
operated in `CronFormat.Standard` mode. 6-field seconds-precision expressions are explicitly
rejected by `ICronScheduleCalculator.IsValid` — this is a deliberate decision, not a limitation
of Cronos itself (see the implementation plan, Abschnitt 4/12.1, for the full rationale).

## Delayed (one-off) execution

`JobTriggerType.Once` jobs carry a `RunAtUtc` instead of a cron expression. The dispatcher poll
interval (default 5s) is deliberately much finer than cron's minute resolution specifically so
that delayed jobs are picked up promptly.

## Leasing (single-node correctness across multiple hosts)

The dispatcher claims due `JobDefinition` rows via `FOR UPDATE SKIP LOCKED` (PostgreSQL) so two
host instances never claim the same row in the same poll tick. A `JobLeaseReaperService`
separately reaps `Running` executions whose lease has expired (host likely crashed
mid-execution), marking them `Failed` and letting the normal retry policy take over.

Distributed, cluster-wide job affinity/sharding beyond this leasing scheme is out of scope for
v1.

## Retry / backoff

`IJobRetryPolicy.GetNextDelay(attemptNumber, strategy, baseDelay)`:

- `Fixed`: constant `baseDelay`.
- `Exponential`: `baseDelay * 2^(attemptNumber - 1)`, capped at `JobRetryOptions.MaxBackoffCap`
  (default 1 hour).

Retries exhausted (`AttemptNumber >= MaxAttempts`) -> the execution is marked `DeadLettered` and
a `JobDeadLetteredEvent` is enqueued via the module's own outbox. Every individual failed
attempt (not just the final dead-letter) also raises a `JobExecutionFailedEvent`.

## Outbox reuse vs. the scheduling query

Jobs reuses the `SDK-Persistence` outbox pattern only for its own lifecycle events
(`JobExecutionFailedEvent`, `JobDeadLetteredEvent`, `JobDefinitionCancelledEvent`) — these are
genuine "this already happened" domain events. The due-job scheduling query itself
(`NextRunAtUtc <= now`) is a time-based state transition, not an event, and is served by a
dedicated leasing query against `job_definitions`/`job_executions`, structurally similar to
`OutboxDispatcher<TContext>` but not the same mechanism.

## Lifecycle-event delivery

`JobsModule` registers its own outbox dispatcher, `OutboxDispatcher<JobsDbContext>`, plus the
per-context store `IOutboxStore<JobsDbContext>` (`EfOutboxStore<JobsDbContext>`, Persistence 2.1).
The dispatcher polls `jobs.outbox_messages`, publishes each event through `IDomainEventPublisher`
(SDK-Audit picks up all three events via its `IAuditableEvent` handler) and cleans up processed and
dead-lettered rows after the retention period.

- **Always on, also with `UseExternalScheduler = true`:** `JobScheduler.CancelAsync` writes
  `JobDefinitionCancelledEvent` in that mode too. Opt out with `Jobs:Outbox:Enabled = false`.
- **Options:** the `Jobs:Outbox` section binds onto `OutboxOptions` of the Jobs dispatcher only (see
  [Configuration](40-configuration.md)). Defaults come from Persistence: poll every 10 s, batch 50,
  10 attempts with exponential backoff, then dead-letter; retention 7 days.
- **Multiple host instances** are safe: messages are claimed with a lease (Persistence 2.0+).
- **At-least-once:** an event can be published more than once (crash between publish and status
  update, lease expiry). The SDK-Audit handler does not deduplicate, so such a case produces a
  duplicate audit entry.
- **In-memory mode** (`AddJobsInMemory` / `Jobs:UseInMemory = true`): the same EF store runs against
  the in-memory `JobsDbContext`, so events written by `ExecuteWithOutboxAsync` are delivered there as
  well (single process only, no row locks). The registration ignores EF Core's
  `TransactionIgnoredWarning`, because `ExecuteWithOutboxAsync` and the outbox claim begin a
  transaction that the in-memory provider cannot honour and would otherwise reject. A host that
  registers its own in-memory `IDbContextFactory<JobsDbContext>` has to configure
  `ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))` itself.

### Upgrading to Jobs 0.3 (Persistence 2.1)

Before 0.3, Jobs registered no outbox dispatcher. Its events were only published if another
module's dispatcher happened to pick up the Jobs store (a last-registration-wins side effect that
Persistence 2.1 removes), and `jobs.outbox_messages` was never cleaned up. Jobs 0.3 requires
Persistence and Persistence.Postgres **2.1.0 or later**.

**Existing rows are delivered.** On the first start the dispatcher publishes all `Pending` rows
in batches, so SDK-Audit receives entries with their original `OccurredOnUtc`. To discard the
backlog instead, mark it as processed before deploying (it is then removed by retention):

```sql
-- Status is stored as integer: 0 = Pending, 1 = Processed, 2 = DeadLettered.
UPDATE jobs.outbox_messages
SET "Status" = 1, "ProcessedOnUtc" = now(), "NextAttemptOnUtc" = NULL
WHERE "Status" = 0;
```

### Upgrading with Persistence 2.0

`BieberWorks.SDK.Persistence` 2.0 adds a nullable `NextAttemptOnUtc` column (retry scheduling and
lease for the outbox dispatcher) to every outbox table. Jobs ships the matching EF migration
`AddOutboxNextAttemptOnUtc` for `jobs.outbox_messages` (additive, existing rows become immediately
due). Apply the migration before (or together with) deploying the new version. Update Auth, Jobs and
Webhooks together: mixing Persistence 2.0 with a module version that lacks the migration fails at
startup with a pending-model-change error or a missing-column error.
