# SDK-Admin

Das Modul `SDK-Admin` stellt eine vollständige Admin-Shell für BieberWorks-Hosts bereit. Andere Module klinken sich über `IAdminSection` in den Navigations-Drawer ein — ohne dass der Host Änderungen vornehmen muss.

## Pakete

| Paket | Inhalt |
|---|---|
| `BieberWorks.SDK.Admin.Contracts` | `IAdminPage`, `IAdminSection`, `AdminNavItem`, `AdminPermissions` |
| `BieberWorks.SDK.Admin.UI.MudBlazor` | `AdminLayout`, `AdminShell`, `AdminModule` (`IModule` + `IEndpointModule`), `AddBieberWorksAdmin()` |

## AdminShell-Konzept

`AdminLayout` ist ein MudBlazor-`LayoutComponentBase`, der `BwShellLayout` (aus SDK-UI) als responsive Basis nutzt. Er:

- rendert alle registrierten `IAdminSection`-Implementierungen als `MudNavGroup` im Drawer,
- erlaubt per Drag-and-Drop-Edit-Mode das Umsortieren der Sektionen (Reihenfolge wird via SDK-Settings persistiert, sofern das Modul vorhanden ist),
- schützt den gesamten Body-Bereich durch die Policy `perm:admin:shell:access` (`AdminPermissions.ShellAccess`),
- rendert alle registrierten `IAppBarWidget`-Instanzen (aus SDK-UI) in der AppBar.

`AdminShell` ist ein leichter Wrapper, der `AdminLayout` als `ChildContent` einschließt — nützlich als `DefaultLayout` in einem Blazor-Router-Scope.

::: info Sektionen werden von Fachmodulen registriert
`AddBieberWorksAdmin()` registriert kein eigenes `IAdminSection`. Andere Module (z. B. SDK-Settings, SDK-Storage) registrieren ihre Sektionen über `services.AddSingleton<IAdminSection, MySection>()` in ihrer eigenen `IModule.RegisterServices`-Implementierung.
:::

## Versions-Referenz

Aktuelle stabile Version: **v0.3.0**

Paket-IDs: `BieberWorks.SDK.Admin.Contracts` und `BieberWorks.SDK.Admin.UI.MudBlazor`.
