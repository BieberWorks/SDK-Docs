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
