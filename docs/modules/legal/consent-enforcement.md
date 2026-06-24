# Consent Enforcement — In-Circuit Blazor Guard

SDK-Legal provides server-side Blazor-aware re-consent enforcement to catch in-circuit
navigation that bypasses the HTTP middleware layer.

---

## Problem

Blazor Server in-circuit navigation (e.g. `<NavLink>`, `NavigationManager.NavigateTo`) does
not issue a new HTTP request. An HTTP middleware (`AgbReacceptanceMiddleware` in the consumer)
therefore cannot intercept these navigations. A user whose consent has become stale can freely
navigate inside the app without re-consenting.

---

## Solution: `IConsentEnforcementService` + `LegalConsentGuard`

### `IConsentEnforcementService` (in `Legal.Contracts`)

```csharp
Task<ConsentEnforcementResult> EvaluateAsync(string userId, CancellationToken ct = default);
```

`ConsentEnforcementResult` carries:

| Property | Type | Description |
|---|---|---|
| `RequiresRedirect` | `bool` | `true` when re-consent is needed |
| `RedirectPath` | `string?` | Target path (e.g. `/legal/terms/accept`), `null` otherwise |

The service checks every `requireConsent: true` document from `LegalOptions.Documents`.
For each document it compares `ILegalDocumentService.GetCurrentVersionAsync` (culture: null →
uses `CultureInfo.CurrentUICulture`, identical to the public page render) against the latest
granted consent. The first stale document triggers a redirect result.

**Registered as Scoped** in `LegalModule.RegisterServices`.

Consumers can also call `IConsentEnforcementService` directly — e.g. to consolidate the
consumer middleware with the SDK service and avoid duplicate DB queries.

### `LegalConsentGuard` (in `Legal.UI.MudBlazor`)

Headless Blazor component. Mount **once** in the host layout alongside `<CookieConsentMirror />`.

```razor
<LegalConsentGuard />
<CookieConsentMirror />
```

The guard:

1. Subscribes to `NavigationManager.LocationChanged` after the first interactive render
   (deferred to `OnAfterRenderAsync(firstRender)` — prevents double-subscription during
   Blazor Server prerender).
2. On each navigation (and on initial render), checks whether the current path is exempt.
3. If not exempt, calls `IConsentEnforcementService.EvaluateAsync` for the authenticated user.
4. On a redirect result, calls `NavigationManager.NavigateTo(redirectPath, forceLoad: false)`.
5. Unauthenticated users are skipped (no redirect).
6. Implements `IDisposable` to unsubscribe from `LocationChanged` on teardown.

#### Exempt paths

| Prefix | Reason |
|---|---|
| `/legal/` | Acceptance page itself + other legal routes — prevents redirect loops |
| `/auth/` | Login / logout flows |
| `/_blazor` | Blazor SignalR hub |
| `/_framework` | Blazor framework assets |
| `/api/` | API routes |

---

## HTTP Middleware (Consumer)

The consumer `AgbReacceptanceMiddleware` continues to guard the initial page load (full HTTP
request). `LegalConsentGuard` guards all subsequent in-circuit navigations. Together they
provide complete coverage.

Consumers can optionally refactor their middleware to delegate to `IConsentEnforcementService`
to avoid duplicate evaluation logic.

---

## Consumer Migration Checklist

1. Ensure `AddLegalModule()` is called — `IConsentEnforcementService` is registered automatically.
2. Add `<LegalConsentGuard />` to the host layout (once, alongside `<CookieConsentMirror />`).
3. No changes to `LegalOptions` or documents are needed — the guard reads existing configuration.
