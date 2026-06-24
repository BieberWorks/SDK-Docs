# Routing

## Public routes

| Route | Component | Notes |
|---|---|---|
| `/legal/{Key}` | `LegalDocumentPage` | Generic, key-agnostic |
| `/legal/{Key}/accept` | `ConsentAcceptance` | Re-consent flow, requires auth |

The generic `/legal/{Key}` route covers all document keys.
Consumer can add named routes (e.g. `/agb`, `/datenschutz`) by linking to `/legal/terms` etc.

## Admin routes

| Route | Component | Permission |
|---|---|---|
| `/admin/legal` | `LegalListPage` | `legal:admin` |
| `/admin/legal/{Key}/{Culture}/edit` | `LegalEditPage` | `legal:admin` |

## Culture resolution (Defect-A note)

`LegalDocumentPage` and `ConsentAcceptance` both use `CultureInfo.CurrentUICulture.Name`
as the culture source. This must be consistent with `ILegalDocumentService.GetCurrentVersionAsync`
(which also defaults to `CultureInfo.CurrentUICulture.Name` when no culture is passed).

Using different culture sources (e.g. `.TwoLetterISOLanguageName` in one place and `.Name` in
another) causes the version check to see a different document than the one displayed, triggering
a redirect loop that tears down the Blazor circuit (Defect A from the SkylineNord reference implementation).
