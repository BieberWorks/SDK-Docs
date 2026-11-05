# Permissions & Ownership

## Permission catalog (`JobsPermissionContributor`)

| Permission | Meaning |
|---|---|
| `jobs:view` | View jobs and execution history (prerequisite for everything else). |
| `jobs:retry` | Retry failed job executions. |
| `jobs:cancel` | Cancel job definitions / running executions. |
| `jobs:manage` | Cross-module override: full access regardless of `OwnerModule`. |

## Ownership (data predicate, not a fifth permission)

Every `JobDefinition` carries a mandatory `OwnerModule`, set by the registering consumer module
at `IJobScheduler.ScheduleRecurringAsync`/`ScheduleOnceAsync` time. Without `jobs:manage`, a
caller with `jobs:view`/`jobs:retry`/`jobs:cancel` only sees/manages definitions whose
`OwnerModule` matches their own module context.

`IJobOwnershipGuard` is the single enforcement seam:

- `CanAccessAsync(jobDefinitionId, requiredPermission, ct)` — used by
  `JobScheduler.CancelAsync`/`TriggerNowAsync` and the query service's execution/detail lookups.
- `GetOwnerModuleFilterAsync(ct)` — used as a row filter in `JobQueryService.GetDefinitionsAsync`
  (never a post-hoc access check, to avoid leaking rows via paging/listing).

**Concrete claim mechanism (implementation detail the plan left open, Abschnitt 8/12.7):** this
build reads the caller's module context from a `jobs_owner_module` claim on the authenticated
principal. Hosts that prefer a different mechanism (e.g. a static route-to-module mapping) can
swap `IJobOwnershipGuard` via the normal `TryAdd*` DI-swap seam.

Access denied surfaces as a `JobDomainException` carrying a `DomainError` with code
`Jobs.OwnershipMismatch`, converted to a `403` with the localized
`jobs.errors.ownershipMismatch` message at the Minimal-API boundary — never a raw stack trace,
and never revealing which module actually owns the resource.
