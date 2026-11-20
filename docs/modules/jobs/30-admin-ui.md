# Admin UI

- `Pages/Admin/JobsOverviewPage.razor` (`/admin/jobs`) — lists job definitions via
  `BwDataView<JobDefinitionSummary>` (Key / Owner Module / Trigger / Next Run / Enabled).
  Registered as an `IAdminSection` (`JobsAdminSection`, key `"jobs"`).
- No live push (no SignalR) — v1 has no real-time requirement; the overview uses a manual
  refresh button. This may be extended later.
- Retry/Cancel actions are gated both server-side (`jobs:retry`/`jobs:cancel` + ownership match,
  see `50-permissions-ownership.md`) and client-side (buttons hidden for non-owners without
  `jobs:manage`, to avoid a misleading UI).

`v1` ships the overview page and the `JobExecutionHistoryViewModel` (Presentation layer, ready
for a history/detail page); the dedicated execution-history and execution-detail Razor pages
were not built in this pass — see the final report for the explicit list of deviations from the
implementation plan.
