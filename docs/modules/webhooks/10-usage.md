# Usage

## Admin UI

- `/admin/webhooks/endpoints` — endpoint CRUD, event-type multi-select (from the registered
  event registry, no free-text entry), secret rotation (shown once).
- `/admin/webhooks/deliveries` — delivery log with endpoint/status/event-type/date-range
  filters, attempt history, manual re-delivery.

## Consumer verification contract

Every delivery includes the header:

```
X-Webhooks-Signature: t=<unix_ts>,v1=<hex_hmac_sha256>
```

where `hex_hmac_sha256 = HMAC-SHA256(secret, "{t}.{raw_json_body}")`.

Reject any request where `|now - t| > 5 minutes` (replay protection). The body carries a
stable `id` field (`WebhookEnvelope.Id`) for idempotent processing.

## Admin client (`IWebhooksAdminClient`)

`IWebhooksAdminClient` has two transports with identical semantics. Every method returns
`Result` / `Result<T>`; expected failures are values, not exceptions:

| Failure | `DomainErrorType` | Code |
|---|---|---|
| Unknown endpoint / delivery | `NotFound` | `Webhooks.Endpoint.NotFound` / `Webhooks.Delivery.NotFound` |
| Rejected URL | `Validation` | `Webhooks.Endpoint.InvalidUrl` |
| Missing permission | `Forbidden` | `Client.Forbidden` |
| No authenticated caller | `Unauthorized` | `Client.Unauthenticated` |
| Network error, timeout, 5xx | `Unavailable` | `Client.Unavailable` |

- **HTTP** (Blazor WASM, remote consumers): `services.AddBieberWorksWebhooksClient("https://api.example.com/")`
  registers `HttpWebhooksAdminClient` (based on `BwHttpClientBase`) through `AddBwHttpClient` and returns the
  `IHttpClientBuilder` so handlers can be chained. An `IErrorLocalizer` must be registered.
- **In-process** (server hosts): `WebhooksModule` registers an internal in-process client as
  `IWebhooksAdminClient`. It checks the same permission keys as the endpoints
  (`webhooks:endpoint:view|manage`, `webhooks:delivery:view|redeliver`) before dispatching.

The Minimal-API endpoints answer failures with ProblemDetails carrying the error code in the `code`
extension member (404 NotFound, 422 Validation, 401/403 for auth), so both transports map to the same result.
