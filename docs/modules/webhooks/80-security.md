# Security

## HMAC signing

Stripe-style scheme: `X-Webhooks-Signature: t=<unix_ts>,v1=<hex_hmac_sha256>`, signing
`"{t}.{raw_json_body}"`. Secrets are 32 random bytes, generated server-side, shown to the
admin exactly once, and stored encrypted at rest via `IDataProtector` — never in plaintext,
never re-displayed, never logged.

## SSRF hardening

- Scheme MUST be `https` (configurable escape hatch for local dev only, off by default).
- Hostname resolved and checked against private/loopback/link-local/metadata ranges both at
  endpoint creation and at delivery time (DNS-rebinding protection).
- Outbound `HttpClient` never follows redirects (`AllowAutoRedirect = false`); a 3xx response
  is recorded as a failed, retriable attempt.
- Outbound timeout capped at ~10s.
- No ambient service-to-service credentials are attached to outbound requests.

## Logging discipline

`WebhookDeliveryAttempt.ErrorSummary` is produced by a sanitizing formatter that strips
`Authorization`/`X-Webhooks-Signature` header values and truncates response bodies. Endpoint
secrets never appear in any DTO, log line, or UI surface after initial creation/rotation.
