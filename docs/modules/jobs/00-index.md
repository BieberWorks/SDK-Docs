# SDK-Jobs

Background jobs and scheduling module for the BieberWorks SDK: recurring (cron) and delayed
(one-off) execution, retry with backoff, dead-lettering, per-module ownership gating, and an
admin UI for job history/retry/cancel.

Tier 2 module. Depends on Foundation (Tier 0) and Persistence (Tier 1) only; referenced by
consumer modules exclusively through `BieberWorks.SDK.Jobs.Contracts` (`IJobScheduler`,
`IJobQueryService`, `IJobHandler<T>`).

## Packages

| Package | Purpose |
|---|---|
| `BieberWorks.SDK.Jobs.Contracts` | Interfaces/DTOs/domain events. The only contract surface consumers ever reference. |
| `BieberWorks.SDK.Jobs` | Default in-process implementation (EF/Postgres store, dispatcher, lease reaper). |
| `BieberWorks.SDK.Jobs.Presentation` | Framework-neutral ViewModels (CommunityToolkit.Mvvm). |
| `BieberWorks.SDK.Jobs.UI.Blazor` | Framework-agnostic Blazor `ComponentBase` logic. |
| `BieberWorks.SDK.Jobs.UI.Blazor.MudBlazor` | MudBlazor admin pages. |
| `BieberWorks.SDK.Jobs.Client` | Result-returning client contract and HTTP client (see `35-clients.md`). |

See `10-domain-model.md`, `20-scheduling.md`, `30-admin-ui.md`, `40-configuration.md`,
`50-permissions-ownership.md` for details.
