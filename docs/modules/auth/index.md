# Auth

Das Auth-Modul stellt die vollständige Authentifizierungs- und Autorisierungsinfrastruktur für BieberWorks-SDK-Hosts bereit. Es umfasst Benutzerregistrierung, Cookie- und JWT-basiertes Login, Passwort-Flows, E-Mail-Bestätigung, Zwei-Faktor-Authentifizierung, ein flexibles Rollen- und Permission-System sowie fertige MudBlazor-UI-Seiten.

## Was das Modul bietet

- **Dual-Scheme Authentication** — Cookie-Auth für Blazor Server / SSR und JWT Bearer für API-Clients in einem einzigen Host
- **ASP.NET Core Identity** mit PostgreSQL-Backend (Schema `auth`) und eigenem `AuthDbContext` inkl. automatischer Migration
- **Permission-System** — modulübergreifende Permissions, die Rollen zugewiesen werden; feingranulare Absicherung via `[RequiresPermission]` oder `.RequirePermission()`
- **Rollen-Management** — CRUD für Rollen inkl. Permission-Zuweisung über `IRoleManagementService`
- **User-Management** — Admin-Endpunkte zum Sperren/Entsperren von Benutzern und zur Rollen-Zuweisung (`UserManagementModule`)
- **E-Mail-Flows** — Bestätigungs-Mail und Passwort-Reset über `IAuthEmailSender`; optionale Integration mit `SDK-Email`
- **Zwei-Faktor-Authentifizierung** — Aktivieren / Deaktivieren / Code-Verifizierung
- **Rate Limiting** — Login-Versuche werden intern begrenzt (`ILoginRateLimitService`)
- **Fertige MudBlazor-Seiten** — Login, Registrierung, Passwort vergessen, Passwort zurücksetzen, Profil, Sicherheit, Avatar sowie Admin-Seiten für Benutzer- und Rollenverwaltung

## Paket-Übersicht

| Paket | Beschreibung | Wann benötigt |
|---|---|---|
| `BieberWorks.SDK.Auth.Contracts` | Interfaces, DTOs, Domain-Events, Permission-Abstraktion — keine Abhängigkeit auf Impl | Immer wenn ein anderes Modul Auth-Dienste konsumiert |
| `BieberWorks.SDK.Auth` | Vollständige Implementierung: Identity, EF Core, JWT/Cookie, Minimal-API-Endpoints, CQRS-Handler | Im Host, der die Auth-API bereitstellt |
| `BieberWorks.SDK.Auth.Management` | Separates `IModule` für Admin-REST-Endpunkte unter `/api/admin/users` | Wenn Admin-User-Management benötigt wird |
| `BieberWorks.SDK.Auth.UI` | Abstrakte Blazor-Basisklassen (framework-agnostische Logik, `ComponentBase`-Ableitungen) | Transitiv — wird von `.UI.MudBlazor` referenziert |
| `BieberWorks.SDK.Auth.UI.MudBlazor` | Fertige MudBlazor-Razor-Komponenten und -Seiten | Wenn die mitgelieferten Auth-Seiten im Host eingebunden werden |
| `BieberWorks.SDK.Auth.Client` | `HttpAuthClient` — HTTP-Implementierung von `IAuthClient` für WASM/MAUI-Hybrid | Wenn ein externer Client (nicht In-Proc) die Auth-API aufruft |

::: tip Aktuelle Version
Alle Pakete werden gemeinsam released. Aktuelle stabile Version: **v0.13.0**.
:::

## Wann welches Paket

| Szenario | Benötigte Pakete |
|---|---|
| Anderes Fachmodul konsumiert `ICurrentUserProvider` oder `IPermissionService` | `Auth.Contracts` |
| Modul registriert eigene Permissions im Katalog | `Auth.Contracts` (implementiert `IPermissionContributor`) |
| Host stellt Auth-API bereit | `Auth` + optional `Auth.Management` |
| Host mit fertiger Blazor-Oberfläche | `Auth` + `Auth.UI.MudBlazor` |
| Externe WASM-/MAUI-App kommuniziert über HTTP | `Auth.Client` |
