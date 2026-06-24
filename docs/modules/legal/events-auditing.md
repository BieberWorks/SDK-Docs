# Domain Events & Auditing

All Legal module domain events implement `IAuditableEvent` and are automatically picked up
by SDK-Audit's open-generic handler — no direct dependency on SDK-Audit required.

| Event | AuditAction | When raised |
|---|---|---|
| `LegalDocumentUpdatedEvent` | `legal:document:updated` | After `ILegalDocumentService.UpdateAsync` |
| `UserConsentRecordedEvent` | `legal:consent:recorded` | After `IUserConsentService.RecordConsentAsync` |
| `UserConsentRevokedEvent` | `legal:consent:revoked` | After `IUserConsentService.RevokeConsentAsync` |
| `UserDataExportRequestedEvent` | `legal:gdpr:export-requested` | After admin triggers GDPR data export |
| `UserDataErasureRequestedEvent` | `legal:gdpr:erasure-requested` | After erasure request is persisted (pre-saga) |
| `UserDataErasedEvent` | `legal:gdpr:erased` | After the erasure saga completes (Completed or PartiallyFailed) |

Events are published **after** the database commit (Core.Postgres rule: no events before commit).

For GDPR erasure, two events are raised per request: `UserDataErasureRequestedEvent` before the
saga starts (early audit record) and `UserDataErasedEvent` after the final status is committed.
See [gdpr-data-subject-rights.md](gdpr-data-subject-rights.md) for the full saga flow.
