# Routing

## Public routes

| Route | Component | Notes |
|---|---|---|
| `/legal/{Key}` | `LegalDocumentPage` | Generic, key-agnostic; works for all document keys |
| `/terms` | `LegalDocumentPage` | Literal alias for `LegalDocumentKeys.Terms` |
| `/privacy` | `LegalDocumentPage` | Literal alias for `LegalDocumentKeys.Privacy` |
| `/imprint` | `LegalDocumentPage` | Literal alias for `LegalDocumentKeys.Imprint` |
| `/withdrawal` | `LegalDocumentPage` | Literal alias for `LegalDocumentKeys.Withdrawal` |
| `/legal/{Key}/accept` | `ConsentAcceptance` | Re-consent flow, requires authentication |
| `/legal/cookies` | `CookieSettingsPage` | Cookie preference settings |
| `/cookies` | `CookieSettingsPage` | Alias for `/legal/cookies` |

The four literal routes (`/terms`, `/privacy`, `/imprint`, `/withdrawal`) are registered directly on `LegalDocumentPage`. Blazor resolves literal routes before parameterised routes, so these always take precedence over any catch-all slug page registered by another module (e.g. SDK-Pages).

`LegalDocumentPage.ResolveKey()` derives the document key for literal routes by matching the current path segment against `LegalDocumentOptions.DefaultRoute` from `LegalOptions.Documents`.

## Admin routes

| Route | Component | Permission |
|---|---|---|
| `/admin/legal` | `LegalListPage` | `perm:legal:admin` |
| `/admin/legal/{Key}/{Culture}/edit` | `LegalEditPage` | `perm:legal:admin` |
| `/admin/legal/gdpr` | `GdprAdminPage` | `perm:legal:admin` |

## Culture resolution

`LegalDocumentPage` and `ConsentAcceptance` both use `CultureInfo.CurrentUICulture.Name` as the culture source. This must be consistent with `ILegalDocumentService.GetCurrentVersionAsync` (which also defaults to `CultureInfo.CurrentUICulture.Name` when no culture is passed).

`LegalDocumentPage` additionally falls back to `CultureInfo.CurrentUICulture.TwoLetterISOLanguageName` when the full culture name yields no result — for example, when the browser sends `en-US` but the document was seeded only for `en`.

Using different culture sources in different places (e.g. `.TwoLetterISOLanguageName` in one place and `.Name` in another without the fallback) causes the version check to see a different document than the one displayed, which triggers a redirect loop that tears down the Blazor circuit (Defect A from the SkylineNord reference implementation — fixed in v0.1.0).
