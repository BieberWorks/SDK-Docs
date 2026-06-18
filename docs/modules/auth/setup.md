# Setup & Konfiguration

## NuGet-Installation

```bash
dotnet add package BieberWorks.SDK.Auth
dotnet add package BieberWorks.SDK.Auth.Management   # optional: Admin-Endpunkte
dotnet add package BieberWorks.SDK.Auth.UI.MudBlazor  # optional: Blazor-Seiten
```

Andere Module, die nur `ICurrentUserProvider` oder Permission-Contracts benötigen:

```bash
dotnet add package BieberWorks.SDK.Auth.Contracts
```

## Program.cs

Die Reihenfolge der Aufrufe ist verbindlich — `AddBieberWorksModules` muss alle registrierten `IModule`-Implementierungen einsammeln, bevor die Pipeline gebaut wird.

```csharp
using BieberWorks.SDK.Auth;
using BieberWorks.SDK.Auth.Management;
using BieberWorks.SDK.Core.Web.Modularity;

var builder = WebApplication.CreateBuilder(args);

// 1. Alle IModule-Implementierungen per Self-Wiring registrieren
builder.Services.AddBieberWorksModules(builder.Configuration,
    new AuthModule(),
    new UserManagementModule()   // optional
);

// 2. Blazor-Komponenten-Assemblies eintragen (wenn Auth.UI.MudBlazor genutzt wird)
builder.Services
    .AddRazorComponents()
    .AddInteractiveServerComponents()
    .AddAdditionalAssemblies(
        typeof(BieberWorks.SDK.Auth.UI.MudBlazor._Imports).Assembly
    );

var app = builder.Build();

// 3. Middleware-Reihenfolge: Auth vor Authorization
app.UseAuthentication();
app.UseAuthorization();

// 4. Endpunkte aller IEndpointModule mappen
app.MapBieberWorksModules();

// 5. EF Core-Migrationen + Startup-Tasks (Rollen, Permissions) ausführen
await app.InitializeBieberWorksModulesAsync();

await app.RunAsync();
```

::: warning Reihenfolge beachten
`UseAuthentication()` muss **vor** `UseAuthorization()` stehen. `InitializeBieberWorksModulesAsync()` führt EF-Migrationen und den `PermissionStartupTasks`-Lauf aus — dieser muss vor dem ersten Request abgeschlossen sein.
:::

## appsettings.json

### Datenbank-Verbindung

Das Auth-Modul verwendet standardmäßig den Connection-String `AuthDb`. Ist dieser nicht gesetzt, fällt es auf `DefaultConnection` zurück.

```json
{
  "ConnectionStrings": {
    "AuthDb": "Host=localhost;Port=5432;Database=bieberworks;Username=postgres;Password=secret"
  }
}
```

### JWT-Konfiguration

Alle JWT-Einstellungen werden aus dem Abschnitt `JwtSettings` gebunden (`JwtSettings.SectionName = "JwtSettings"`).

```json
{
  "JwtSettings": {
    "Secret": "mindestens-32-zeichen-langer-schluessel",
    "Issuer": "https://meine-app.example.com",
    "Audience": "https://meine-app.example.com",
    "AccessTokenExpirationMinutes": 60,
    "RefreshTokenExpirationDays": 30
  }
}
```

| Eigenschaft | Typ | Beschreibung |
|---|---|---|
| `Secret` | `string` | HMAC-SHA256-Schlüssel; mindestens 32 Zeichen empfohlen |
| `Issuer` | `string` | JWT `iss`-Claim; muss mit `ValidIssuer` bei der Validierung übereinstimmen |
| `Audience` | `string` | JWT `aud`-Claim |
| `AccessTokenExpirationMinutes` | `int` | Gültigkeitsdauer des Access-Tokens in Minuten |
| `RefreshTokenExpirationDays` | `int` | Gültigkeitsdauer des Refresh-Tokens in Tagen |

::: danger Secret aus Konfiguration
Das `Secret` darf **niemals** in versionierten Dateien landen. Verwende `dotnet user-secrets` für die lokale Entwicklung und Environment-Variables / Secret-Manager in Produktion.
:::

### Cookie-Konfiguration

Die Cookie-Einstellungen sind im Code fest definiert und ergeben sich aus `AuthModule`:

| Eigenschaft | Wert |
|---|---|
| Cookie-Name | `bw.auth` |
| `HttpOnly` | `true` |
| `SameSite` | `Strict` |
| `SecurePolicy` | `SameAsRequest` |
| `SlidingExpiration` | `true` |
| Laufzeit | 8 Stunden |

Beim Zugriff ohne Cookie (z. B. API-Client mit `Authorization: Bearer …`) weicht der `Smart`-Policy-Scheme automatisch auf JWT Bearer um.

## Migrationen

Das Modul führt seine EF Core-Migrationen automatisch beim Startup aus (`IModuleInitializer.InitializeAsync`). Eine manuelle Migration ist nicht nötig. Das PostgreSQL-Schema lautet `auth`.

::: info Eigene Migration hinzufügen
```bash
dotnet ef migrations add <Name> --project src/Auth --startup-project <HostProjekt>
```
Das Migrations-Verzeichnis liegt unter `src/Auth/Migrations/`.
:::
