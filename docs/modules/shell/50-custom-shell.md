# Building a Custom Consumer Shell

This is the flagship walkthrough: standing up a brand-new shell for a consumer app — for
example a partner-facing portal — with zero navigation plumbing beyond what SDK-Shell already
provides.

## 1. Define the marker interface

```csharp
namespace Contoso.Partner.Contracts;

using BieberWorks.SDK.Shell.Contracts;

/// <summary>Marker for sections belonging to the Partner shell.</summary>
public interface IPartnerSection : IShellSection { }
```

The marker carries no members of its own — it exists purely to scope `IEnumerable<TMarker>`
resolution to this shell, isolating it from Admin, Account, and any other shell in the same
host.

## 2. Register the shell

```csharp
using BieberWorks.SDK.Shell.Contracts;
using BieberWorks.SDK.Shell.Extensions;

services.AddBwShell<IPartnerSection>(
    new ShellDefinition("partner", "/partner", "Partner Portal"),
    permissionChecker: (sp, permission) =>
    {
        var authz = sp.GetRequiredService<IAuthorizationService>();
        // evaluate `permission` against the current user, e.g. via a policy lookup
        return true;
    });
```

This single call registers `IShellRegistry` participation, the settings-backed override store,
`IShellNavigationService<IPartnerSection>`, and `INavOverrideTarget` for the Partner shell —
identical machinery to Admin and Account, with zero duplicated code.

## 3. Implement a section

```csharp
using BieberWorks.SDK.Shell.Contracts;

internal sealed class InvoicesPartnerSection : IPartnerSection
{
    public string Key   => "invoices";
    public string Title => "Invoices";
    public string Icon  => BwIcon.Receipt;
    public int    Order => 10;

    public IReadOnlyList<ShellNavItem> NavItems =>
    [
        new ShellNavItem { Title = "Overview", Href = "/partner/invoices", Icon = BwIcon.Dashboard },
    ];
}
```

```csharp
services.AddSingleton<IPartnerSection, InvoicesPartnerSection>();
```

Any number of modules can contribute `IPartnerSection` implementations the same way — the
Partner shell's navigation is the union of all registered sections, resolved and merged with
overrides automatically.

## 4. Build a thin layout

```razor
@* PartnerLayout.razor *@
@inherits LayoutComponentBase
@using BieberWorks.SDK.Shell.UI.Blazor.MudBlazor.Layout

<BwShellLayoutBase TMarker="IPartnerSection"
                    DrawerTitle="Partner Portal"
                    RequirePolicy="partner:shell:access"
                    Body="Body" />
```

That's it — `BwShellLayoutBase<TMarker>` handles resolving the nav tree via
`IShellNavigationService<IPartnerSection>`, filtering hidden sections, rendering the drawer with
icon resolution via `IShellIconResolver`, and gating the body behind an authorization policy.

### Anonymous access and access denied

`BwShellLayoutBase<TMarker>` resolves the cascaded `Task<AuthenticationState>` before rendering anything
when `RequireAuthenticatedUser="true"` (default `false`) or a `RequirePolicy` is set (which implies
`RequireAuthenticatedUser`):

| State | Result |
|---|---|
| Authentication state pending | nothing is rendered (no navigation flash) |
| Anonymous | only `BwRedirectToLogin` (`forceLoad` + `replace`); no drawer, no navigation, no `NotAuthorizedContent` |
| Authenticated, policy not satisfied | `NotAuthorizedContent` (or "Access denied."), navigation hidden (checked via `IAuthorizationService`) |
| Authenticated, allowed | shell with navigation and body |

This matters in global interactive render modes: a click inside an established circuit never passes the
HTTP pipeline, so the cookie redirect of SDK-Auth does not run. Use `BwAuthorizeRouteView` (SDK-UI) in
`Routes.razor` as well, and keep `LoginRedirectOptions.LoginPath` equal to `AuthCookieOptions.LoginPath`.
Without a cascaded `AuthenticationState` task the previous behaviour applies. Requires
`BieberWorks.SDK.UI.Blazor.MudBlazor` 1.3.0 or later.

## 5. Wire up routing

Route `IPartnerSection`-marked pages to `PartnerLayout` in `Routes.razor`, the same pattern
Admin uses for `IAdminPage`:

```razor
<RouteView RouteData="@routeData"
           DefaultLayout="@(typeof(IPartnerSection).IsAssignableFrom(routeData.PageType)
                             ? typeof(PartnerLayout)
                             : typeof(MainLayout))" />
```

(Adjust to whatever page-marking convention your app uses — SDK-Shell itself does not prescribe
one; it only resolves navigation.)

## What you get for free

- **No navigation code to write.** Discovery, merge, sort, and orphan handling are all handled
  by `ShellNavResolver` — identical logic Admin and Account already use.
- **Persistent overrides out of the box.** Admins can hide, reorder, rename, or reassign Partner
  shell items the moment SDK-Settings is registered — no extra work.
- **Automatic editor integration.** Host `<BwShellNavEditor />` anywhere (e.g. inside the Admin
  area, or a dedicated Partner-ops page) and a "Partner Portal" tab appears automatically,
  because `AddBwShell<IPartnerSection>` already registered its `INavOverrideTarget`. Nothing in
  `BwShellNavEditor` needs to know the Partner shell exists.
- **Isolation for free.** Because sections are resolved via `IEnumerable<IPartnerSection>`
  rather than `IEnumerable<IShellSection>`, an `IAdminSection` implementation in some other
  module can never accidentally leak into the Partner shell's navigation, and vice versa.
