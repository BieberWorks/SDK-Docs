# SDK-Account

Das Modul `SDK-Account` stellt eine Self-Service-Shell für eingeloggte Benutzer bereit ("Mein Konto"). Das Konzept ist analog zu SDK-Admin: Fachmodule klinken sich über `IAccountSection` in den Navigations-Drawer ein.

## Pakete

| Paket | Inhalt |
|---|---|
| `BieberWorks.SDK.Account.Contracts` | `IAccountPage`, `IAccountSection`, `AccountNavItem` |
| `BieberWorks.SDK.Account.UI.MudBlazor` | `AccountLayout`, `AccountShell`, `AccountModule` (`IModule` + `IEndpointModule`), `AddBieberWorksAccount()` |

## AccountShell-Konzept

`AccountLayout` ist ein MudBlazor-`LayoutComponentBase`, der `BwShellLayout` (aus SDK-UI) als responsive Basis nutzt. Er:

- rendert alle registrierten `IAccountSection`-Implementierungen als `MudNavGroup` im Drawer,
- unterstützt optionale Permission-Checks pro Sektion über `IAccountSection.RequiredPermission` (Policy-Format `perm:{key}`),
- rendert alle registrierten `IAppBarWidget`-Instanzen (aus SDK-UI) in der AppBar,
- setzt den Layout-Theme-Key auf `"account"` über `ILayoutThemeContext`.

`AccountShell` ist ein leichter Wrapper, der `AccountLayout` als `ChildContent` einschließt — nützlich als `DefaultLayout` in einem Blazor-Router-Scope.

::: info Unterschied zu AdminLayout
`AccountLayout` schützt den Body nicht pauschal per Policy — alle Inhalte sind sichtbar, solange keine `RequiredPermission` an der Sektion gesetzt ist. Einzelne Sektionen können optional per Permission ausgeblendet werden. `AdminLayout` hingegen schützt den gesamten Bereich durch `perm:admin:shell:access`.
:::

## Versions-Referenz

Aktuelle stabile Version: **v0.0.1**

Paket-IDs: `BieberWorks.SDK.Account.Contracts` und `BieberWorks.SDK.Account.UI.MudBlazor`.
