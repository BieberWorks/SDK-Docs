# Content Model

## LegalDocument

Schema `legal`, table `legal_documents`.

| Column | Type | Notes |
|---|---|---|
| Id | uuid | PK |
| DocumentKey | varchar(200) | e.g. "terms", "privacy" |
| Culture | varchar(10) | BCP-47, e.g. "en", "de" |
| Content | text | Markdown |
| Version | int | Monotonically increasing |
| LastModified | timestamptz | UTC |

Unique index on `(DocumentKey, Culture)`.

## UserConsent

Schema `legal`, table `user_consents`. **Append-only.**

| Column | Type | Notes |
|---|---|---|
| Id | uuid | PK |
| UserId | varchar(450) | ASP.NET Identity user ID |
| DocumentKey | varchar(200) | |
| ConsentKey | varchar(200)? | Optional sub-key |
| AcceptedVersion | int? | Version accepted; null for non-versioned |
| Granted | bool | true=grant, false=revoke |
| AcceptedAt | timestamptz | UTC, when record was created |
| RevokedAt | timestamptz? | UTC, set on revocation rows |

Indexes on `(UserId)` and `(UserId, DocumentKey)`.

Revocation writes a **new row** with `Granted=false` — old rows are never modified.
This gives a full auditable consent history.
