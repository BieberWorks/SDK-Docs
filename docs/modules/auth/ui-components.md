# UI-Komponenten

Das Paket `BieberWorks.SDK.Auth.UI.MudBlazor` enthält fertige Blazor-Seiten und -Komponenten auf Basis von MudBlazor 9. Jede Seite besteht aus zwei Schichten:

- **`Auth.UI`** — abstrakte `ComponentBase`-Basisklasse mit der gesamten Logik (Injections, Event-Handler, State)
- **`Auth.UI.MudBlazor`** — Razor-Datei, die nur `@inherits` auf die Basisklasse setzt und das MudBlazor-Markup rendert

## Einbinden in den Host

### 1. NuGet-Paket referenzieren

```bash
dotnet add package BieberWorks.SDK.Auth.UI.MudBlazor
```

### 2. Assembly in Program.cs registrieren

```csharp
builder.Services
    .AddRazorComponents()
    .AddInteractiveServerComponents()
    .AddAdditionalAssemblies(
        typeof(BieberWorks.SDK.Auth.UI.MudBlazor._Imports).Assembly
    );
```

### 3. Assembly im Router eintragen (Routes.razor)

```razor
<Router AppAssembly="typeof(App).Assembly"
        AdditionalAssemblies="new[] { typeof(BieberWorks.SDK.Auth.UI.MudBlazor._Imports).Assembly }">
    <Found Context="routeData">
        <RouteView RouteData="routeData" DefaultLayout="typeof(MainLayout)" />
    </Found>
</Router>
```

::: warning Beide Einträge notwendig
`AddAdditionalAssemblies` in `Program.cs` allein reicht nicht — der `Router` rendert Seiten aus fremden Assemblies nur, wenn die Assembly auch dort eingetragen ist. Fehlt der Router-Eintrag, erscheint "Not Found" für alle Auth-Seiten.
:::

## Enthaltene Seiten

### Öffentliche Seiten

| Seite | Route | Beschreibung |
|---|---|---|
| `Login.razor` | `/auth/login` | Login-Formular mit E-Mail/Benutzername, Passwort, "Angemeldet bleiben"; unterstützt `?returnUrl=` |
| `Register.razor` | `/auth/register` | Registrierungsformular (E-Mail, Passwort, Bestätigung) |
| `ForgotPassword.razor` | `/auth/forgot-password` | E-Mail-Eingabe für den Passwort-Reset-Link |
| `ResetPassword.razor` | `/auth/reset-password` | Neues Passwort setzen via `?email=&token=` aus dem Reset-Link |
| `Logout.razor` | `/auth/logout` | Ruft `IAuthClient.LogoutAsync()` auf und navigiert zur Startseite |

### Account-Seiten (erfordern Login)

| Seite | Route | IAccountPage |
|---|---|---|
| `Profile.razor` | `/auth/profile`, `/account/profile` | Ja — erscheint in der Account-Navigation |
| `Security.razor` | `/account/security` | Ja — Passwort ändern |
| `AvatarPage.razor` | `/account/avatar` | Ja — Avatar hochladen (benötigt `SDK-Storage`) |

### Admin-Seiten (erfordern Permissions)

| Seite | Route | Benötigte Permission |
|---|---|---|
| `UserListPage.razor` | `/admin/users` | `auth:users:read` |
| `UserDetailPage.razor` | `/admin/users/{userId}` | `auth:users:read` |
| `RoleListPage.razor` | `/admin/roles` | `auth:roles:read` |
| `RoleEditPage.razor` | `/admin/roles/{roleId}` | `auth:roles:manage` |

Admin-Seiten implementieren `IAdminPage` und erscheinen automatisch in der Admin-Navigation, wenn `SDK-Admin` ebenfalls installiert ist.

## Enthaltene Komponenten

### UserMenu.razor

Zeigt ein Benutzer-Menü in der AppBar an (Name, Avatar-Initialen, Logout-Link). Implementiert `IAppBarComponent` aus `SDK-UI`.

```razor
@* Einbinden in die eigene AppBar-Komponente: *@
@foreach (var component in AppBarComponents)
{
    <DynamicComponent Type="component.GetType()" />
}
```

## Lokalisierung

Alle Texte werden über `IStringLocalizer<AuthResources>` geladen. Das Modul liefert eingebettete `.resx`-Dateien für Deutsch und Englisch. Mit `SDK-Localization` können einzelne Texte zur Laufzeit aus der Datenbank überschrieben werden.

## IAuthClient

Die UI-Seiten kommunizieren ausschließlich über `IAuthClient` (aus `Auth.Contracts`) mit dem Backend. Im selben Prozess (Blazor Server) ist `InProcAuthClient` registriert. Für externe Clients (WASM/MAUI) liefert `Auth.Client` die `HttpAuthClient`-Implementierung:

```csharp
// In einer WASM-/MAUI-App:
builder.Services.AddAuthHttpClient("https://api.example.com/");
```

`AddAuthHttpClient` registriert `HttpAuthClient` als `IAuthClient` mit einem benannten `HttpClient`.

## Validierungs-Attribute

Das Paket `Auth.UI` enthält lokalisierte DataAnnotations-Attribute für Formular-Validierungen:

| Attribut | Beschreibung |
|---|---|
| `LocalizedRequiredAttribute` | Pflichtfeld mit lokalisierter Fehlermeldung |
| `LocalizedEmailAddressAttribute` | E-Mail-Format-Prüfung |
| `LocalizedMinLengthAttribute` | Mindestlänge |
| `LocalizedStringLengthAttribute` | Min-/Maxlänge |
| `LocalizedCompareAttribute` | Zwei Felder vergleichen (z. B. Passwort-Bestätigung) |
| `LocalizedRegexAttribute` | Regex-Prüfung |

Diese Attribute lesen ihre Fehlermeldungen aus `IStringLocalizer<AuthResources>` und sind damit vollständig in das Lokalisierungssystem integriert.
