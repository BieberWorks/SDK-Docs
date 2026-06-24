# Cookie Consent

SDK-Legal activates the SDK-UI cookie-consent banner by registering cookie categories
at module startup. The full cookie infrastructure (banner UI, consent persistence, JS interop)
lives in `BieberWorks.SDK.UI` — SDK-Legal is solely the configuration provider and the
optional server-side mirror for authenticated users.

## How it works

`LegalModule.RegisterServices` reads `LegalOptions.CookieRegistrations` and calls
`services.RegisterCookies(...)` from `BieberWorks.SDK.UI.Contracts.Cookies`.
The `CookieBanner` component (in `BieberWorks.SDK.UI.MudBlazor`) displays itself
automatically as soon as at least one non-`Necessary` registration exists.

## Configuring registrations

Override the default registrations in your host's `appsettings.json` or via
`services.Configure<LegalOptions>`:

```json
{
  "Legal": {
    "CookieRegistrations": [
      { "Name": "bw.consent",   "Category": "Necessary", "Description": "Stores your cookie preferences.", "Module": "Legal" },
      { "Name": "_ga",          "Category": "Analytics",  "Description": "Google Analytics tracking.",       "Module": "Legal" },
      { "Name": "fbp",          "Category": "Marketing",  "Description": "Facebook Pixel.",                  "Module": "Legal" }
    ]
  }
}
```

Default registrations:

| Name           | Category  | Description                                        |
|----------------|-----------|----------------------------------------------------|
| `bw.consent`   | Necessary | Stores your cookie preferences.                    |
| `bw.analytics` | Analytics | Anonymous usage analytics (placeholder — opt-in).  |

The default intentionally includes one non-Necessary entry so the banner appears
out of the box. Replace the Analytics placeholder with your actual tracking cookies.

## Host layout requirements

### Required: CookieBanner (SDK-UI)

`CookieBanner` must be mounted **once** in your host layout (e.g. `MainLayout.razor`):

```razor
@using BieberWorks.SDK.UI.MudBlazor

<CookieBanner />
```

### Required for authenticated-user mirroring: CookieConsentMirror (SDK-Legal)

`CookieConsentMirror` is a headless component that mirrors the cookie choice of
authenticated users into the `UserConsent` table (document key `"cookies"`).
This provides a server-side audit trail for GDPR compliance.

Mount it **once** in the same layout as `CookieBanner`:

```razor
@using BieberWorks.SDK.Legal.UI.MudBlazor

<CookieConsentMirror />
```

`CookieConsentMirror` is the **sole** mirroring path. It subscribes to
`ICookieConsentService.OnConsentChanged`, which fires exactly once per
`SetConsentAsync` call — whether triggered by the banner or by the Cookie
Settings page. This guarantees one `UserConsent` row per user action.

Without this component, cookie preferences are stored only in the browser
cookie; no `UserConsent` rows are written for authenticated users.

## Cookie Settings page

Route: `/legal/cookies` (alias `/cookies`)

This page lets users review and change their cookie preferences after the banner
has been dismissed. It reads registrations from `ICookieConsentService.GetRegistrations()`,
renders a toggle per non-Necessary category and provides two actions:

- **Save preferences** — calls `ICookieConsentService.SetConsentAsync`, which fires
  `OnConsentChanged`. `CookieConsentMirror` (if mounted) picks that event up and writes
  the single `UserConsent` row. The settings page itself does **not** call
  `IUserConsentService` directly.
- **Show cookie banner again** — calls `ICookieConsentService.RequestReopen()`, which
  triggers `OnReopenRequested` and causes the banner to re-display.

Expose an entry point to this page wherever appropriate (e.g. in the site footer or
Account section).

## Single-source mirroring

`CookieConsentMirror` is the **only** path that writes `UserConsent` rows for cookie
consent. Both the banner accept and the Cookie Settings page save call
`ICookieConsentService.SetConsentAsync`, which fires `OnConsentChanged` exactly once.
`CookieConsentMirror` handles that single event → one row per user action, no
duplicates.

The `UserConsent` table is append-only: multiple distinct save actions (e.g. banner
accept, then a later settings change) each produce their own history row, which is
correct and intentional.

## Router registration

Add the assembly to your host's `Program.cs` and `Routes.razor` (required for all
`Legal.UI.MudBlazor` pages):

**Program.cs:**
```csharp
app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode()
    .AddAdditionalAssemblies(typeof(BieberWorks.SDK.Legal.UI.MudBlazor.LegalAdminSection).Assembly);
```

**Routes.razor:**
```razor
<Router AppAssembly="@typeof(App).Assembly"
        AdditionalAssemblies="new[] { typeof(BieberWorks.SDK.Legal.UI.MudBlazor.LegalAdminSection).Assembly }">
```
