# SDK-Webhooks

Outbound webhooks for consumer integrations: register HTTPS endpoints, subscribe them to
domain-event types, sign payloads with HMAC, deliver with retry/backoff, and expose a
delivery log for observability and manual re-delivery.

## Packages

- `BieberWorks.SDK.Webhooks.Contracts` — interfaces, DTOs, `IWebhookEvent` marker, signature contract.
- `BieberWorks.SDK.Webhooks` — implementation: DbContext, outbox wiring, delivery worker, HMAC signer, HTTP dispatch, Minimal-API endpoints.
- `BieberWorks.SDK.Webhooks.Presentation` — framework-neutral ViewModels.
- `BieberWorks.SDK.Webhooks.UI.Blazor` — framework-agnostic ComponentBase logic.
- `BieberWorks.SDK.Webhooks.UI.Blazor.MudBlazor` — MudBlazor admin pages.
- `BieberWorks.SDK.Webhooks.Client` — WASM-safe HTTP client.

## See also

- [Getting Started](./01-getting-started.md)
- [Usage](./10-usage.md)
- [Security](./80-security.md)
- [Changelog](./90-changelog.md)
