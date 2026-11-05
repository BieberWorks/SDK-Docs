# Domain Model

Schema: `jobs` (own PostgreSQL schema; no cross-module joins, only opaque IDs/strings).

## Entities

### JobDefinition

The "configuration" — what should run, when, and under which retry policy.

- `Id`, `Key` (unique business key), `OwnerModule` (mandatory, foundation of ownership gating)
- `HandlerTypeName` (discriminator resolved to `IJobHandler<T>` via DI)
- `TriggerType` (`Cron` / `Once` / `Manual`), `CronExpression`, `RunAtUtc`
- `PayloadJson` (opaque JSON handed to the handler)
- `IsEnabled`, `MaxAttempts`, `BackoffStrategy`, `BackoffBaseDelaySeconds`
- `NextRunAtUtc` (computed, indexed for the dispatcher poll query)

### JobExecution

The "history" — one attempt. Every retry is its own row (attempt history), never overwritten.

- `Id`, `JobDefinitionId` (intra-module FK), `Status`, `AttemptNumber`
- `ScheduledForUtc`, `StartedAtUtc`, `CompletedAtUtc`, `DurationMs`
- `ErrorMessage`, `ErrorStackTrace`
- `LeaseOwner`, `LeaseExpiresAtUtc` (single-node leasing against double execution)
- `NextRetryAtUtc`

## Enums

```csharp
public enum JobTriggerType { Cron, Once, Manual }
public enum JobExecutionStatus { Scheduled, Running, Succeeded, Failed, Retrying, DeadLettered, Cancelled }
public enum JobBackoffStrategy { Fixed, Exponential }
```

No separate `Schedule` entity in v1 — `JobDefinition` carries trigger info directly. A future
split into a dedicated `Schedule` table remains additive (no breaking change).
