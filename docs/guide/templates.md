# BieberWorks Consumer Templates

Die Consumer-Templates scaffolden lauffaehige Startpunkte fuer Anwendungen, die das BieberWorks SDK nutzen. Sie sind kein Framework-Boilerplate – sie zeigen den konkreten SDK-Startup-Flow (`AddBieberWorksModules`, `MapBieberWorksModules`, `BwThemeProvider`) und enthalten ein Beispiel-Modul (`WeatherModule`), das zeigt wie ein eigenes `IModule` aufgebaut wird.

---

## Installation

### Voraussetzungen

- .NET 10 SDK
- GitHub PAT mit `read:packages` fuer GitHub Packages der Org `BieberWorks`

### Templates installieren

```powershell
dotnet new install BieberWorks.Templates
```

Alle fuenf Templates stehen danach unter `dotnet new bw-*` zur Verfuegung.

---

## Uebersicht

| Template     | Anwendungsfall                                              | Projekte                          |
|--------------|-------------------------------------------------------------|-----------------------------------|
| `bw-api`     | REST-API ohne UI                                            | Api, WeatherModule, Api.Tests     |
| `bw-blazor`  | Blazor Server App mit UI                                    | Web, WeatherModule, Web.Tests     |
| `bw-wasm-api`| Blazor WASM Frontend + eigenstaendiges API-Backend          | Api, Client, WeatherModule, Api.Tests |
| `bw-wasm`    | Blazor WASM Client fuer eine externe (bereits vorhandene) API | Client, Client.Tests             |
| `bw-module`  | Einzelnes Modul-Projekt fuer eine bestehende Solution       | ein Projekt (Projekt-Template)    |

---

## bw-api

### Wann verwenden?

Wenn die Anwendung ausschliesslich eine REST-API bereitstellt und keine Blazor-UI benoetigt. Typischer Fall: Backend-Service, das von einem separaten Frontend (WASM, Mobile, SPA) konsumiert wird.

### Scaffolden

```powershell
dotnet new bw-api -n MeinProjekt
```

Erzeugt das Verzeichnis `MeinProjekt/` mit einer fertigen `.slnx`-Solution.

### Projektstruktur

```
MeinProjekt/
  src/
    MeinProjekt.Api/          # ASP.NET Core Host; Program.cs mit BieberWorks-Startup
    WeatherModule/            # Beispiel-IModule – loeschen und durch eigene Module ersetzen
  tests/
    MeinProjekt.Api.Tests/    # xUnit-Testprojekt
  nuget.config                # GitHub Packages Quelle (bieberworks)
```

### Enthaltene SDK-Pakete

| Paket                         | Zweck                                              |
|-------------------------------|----------------------------------------------------|
| `BieberWorks.SDK.Core`        | `IModule`, Messaging, Module-Discovery             |
| `BieberWorks.SDK.Core.Web`    | `IEndpointModule`, `AddBieberWorksModules()`, `MapBieberWorksModules()` |
| `Microsoft.AspNetCore.OpenApi`| OpenAPI-Metadaten                                  |
| `Scalar.AspNetCore`           | Scalar API-Referenz (Dev-Only)                     |

Alle weiteren SDK-Module (Auth, Audit, Email, …) werden als auskommentierte `PackageReference`-Beispiele mitgeliefert und durch Einkommentieren aktiviert.

### Nächste Schritte

1. `nuget.config`: `DEIN_GITHUB_USERNAME` ersetzen und `BIEBERWORKS_NUGET_TOKEN` als Umgebungsvariable setzen (siehe [Token-Konfiguration](#token-konfiguration-bieberworks_nuget_token)).
2. `WeatherModule` als Referenz lesen, dann loeschen und durch `dotnet new bw-module -n MeinModul` ersetzen.
3. Fachmodule per `PackageReference` hinzufuegen – sie verkabeln sich selbst via `AddBieberWorksModules`.
4. Auth aktivieren: `BieberWorks.SDK.Auth` referenzieren, `appsettings.json` befuellen, `app.UseAuthentication()` / `app.UseAuthorization()` einkommentieren.

---

## bw-blazor

### Wann verwenden?

Wenn die Anwendung eine vollstaendige Blazor Server App sein soll – mit UI, MudBlazor-Komponenten und dem BieberWorks UI-Stack (`BwThemeProvider`, `BwRouter`, `LanguageSwitcher`, `DarkModeToggle`). Alles laeuft serverseitig; kein seperates API-Projekt, kein WASM.

### Scaffolden

```powershell
dotnet new bw-blazor -n MeinProjekt
```

### Projektstruktur

```
MeinProjekt/
  src/
    MeinProjekt.Web/          # Blazor Server Host; Program.cs + Routes.razor mit BwThemeProvider
      Components/
        Layout/MainLayout.razor
        Pages/Home.razor
        Routes.razor          # BwThemeProvider + BwRouter (NICHT in Layout verschieben)
        App.razor
    WeatherModule/            # Beispiel-IModule
  tests/
    MeinProjekt.Web.Tests/
  nuget.config
```

### Enthaltene SDK-Pakete

| Paket                           | Zweck                                                     |
|---------------------------------|-----------------------------------------------------------|
| `BieberWorks.SDK.Core`          | `IModule`, Messaging, Module-Discovery                    |
| `BieberWorks.SDK.Core.Web`      | `AddBieberWorksModules()`, `MapBieberWorksModules()`, `AddBwModuleAssemblies()` |
| `BieberWorks.SDK.UI.MudBlazor`  | `BwThemeProvider`, `BwRouter`, `ILayoutThemeContext`, AppBar-Widgets, UI-Infrastruktur |
| `MudBlazor`                     | `9.*`, explizit referenziert zur Versionskontrolle        |

### Wichtige Konventionen

**`BwThemeProvider` steht genau einmal in `Routes.razor`** als aeusserstes Element. Er darf nicht in ein Layout verschoben werden – das bricht den ThemeService-State bei Layout-Wechseln.

**`BwRouter` ersetzt den Standard-`<Router>`-Tag.** Er loest Route-Konflikte zwischen Host-Assembly und geladenen SDK-Modul-Assemblies auf (Host-Routen haben Prioritaet).

**`AddBwModuleAssemblies()`** in `MapRazorComponents` discovert automatisch alle `BieberWorks.SDK.*.MudBlazor`-Assemblies, die per NuGet referenziert sind. Kein manueller `AddAdditionalAssemblies`-Eintrag pro SDK-Paket noetig. Eigene Projekte mit Razor-Seiten (wie ein `WeatherModule.Web`) muessen weiterhin manuell per `.AddAdditionalAssemblies(typeof(WeatherModuleModule).Assembly)` hinzugefuegt werden.

### Nächste Schritte

1. Token konfigurieren (siehe [Token-Konfiguration](#token-konfiguration-bieberworks_nuget_token)).
2. `WeatherModule` als IModule-Referenz nutzen, dann durch eigene Module ersetzen.
3. Auth aktivieren: `BieberWorks.SDK.Auth` + `BieberWorks.SDK.Auth.UI.MudBlazor` referenzieren, `AddAuthUi()` in `Program.cs` einkommentieren.
4. Admin-Shell: `BieberWorks.SDK.Admin.UI.MudBlazor` + `AddBieberWorksAdmin()` – fuegt `/admin/**`-Routing und `AdminLayout` hinzu.
5. Account-Shell: analog mit `BieberWorks.SDK.Account.UI.MudBlazor` + `AddBieberWorksAccount()`.

---

## bw-wasm-api

### Wann verwenden?

Wenn das Projekt aus zwei getrennten Deployments bestehen soll: einem ASP.NET Core API-Backend (traegt BieberWorks-Module, EF Core, Identity) und einem Blazor WebAssembly Frontend, das per HTTP mit der API kommuniziert. Die Template-Solution enthaelt beide Projekte und eine vorkonfigurierte CORS-Policy fuer lokale Entwicklung.

### Scaffolden

```powershell
dotnet new bw-wasm-api -n MeinProjekt
```

### Projektstruktur

```
MeinProjekt/
  src/
    MeinProjekt.Api/          # ASP.NET Core Host (Server) – traegt alle BieberWorks-Module
    MeinProjekt.Client/       # Blazor WebAssembly (Browser) – kommuniziert per HttpClient mit Api
    WeatherModule/            # Beispiel-IModule (nur Api-seitig referenziert)
  tests/
    MeinProjekt.Api.Tests/
  nuget.config
```

### Paket-Aufteilung (API vs. Client)

Dies ist der zentrale Unterschied zu allen anderen Templates.

**Api-Projekt** (`Microsoft.NET.Sdk.Web`):

| Paket                         | Zweck                                              |
|-------------------------------|----------------------------------------------------|
| `BieberWorks.SDK.Core`        | `IModule`, Messaging, Module-Discovery             |
| `BieberWorks.SDK.Core.Web`    | `AddBieberWorksModules()`, `MapBieberWorksModules()` |
| `Microsoft.AspNetCore.OpenApi`| OpenAPI                                            |
| `Scalar.AspNetCore`           | Scalar API-Referenz (Dev-Only)                     |

Hinzufuegen per `PackageReference` (auskommentierte Beispiele bereits in der `.csproj`):
- `BieberWorks.SDK.Auth` – Identity + JWT (serverseitig)
- `BieberWorks.SDK.Audit`, `BieberWorks.SDK.Email`, … – alle Impl-Pakete

**Client-Projekt** (`Microsoft.NET.Sdk.BlazorWebAssembly`):

| Paket                           | Zweck                                                        |
|---------------------------------|--------------------------------------------------------------|
| `BieberWorks.SDK.UI.MudBlazor`  | `BwThemeProvider`, `ILayoutThemeContext`, UI-Infrastruktur   |
| `MudBlazor`                     | `9.*`                                                        |

Hinzufuegen (auskommentiert):
- `BieberWorks.SDK.Auth.Client` – `IAuthService` fuer WASM, JWT-Bearer-HttpClient-Handler
- `BieberWorks.SDK.Auth.Contracts` – `ICurrentUserService`, `IRoleProvider` (nur wenn Contracts benoetigt)
- `BieberWorks.SDK.Auth.UI.MudBlazor` – Login/Register-Seiten als Razor-Komponenten

**Was im Client-Projekt NICHT referenziert wird:**
- `BieberWorks.SDK.Auth` (Impl) – enthaelt EF Core und ASP.NET Identity, laeuft nicht im Browser
- `BieberWorks.SDK.Core.Web` – `IEndpointModule` und `MapBieberWorksModules` haben im Browser keinen Sinn
- `BieberWorks.SDK.Core` – der Client hat keine Module; `AddBieberWorksModules()` wird nicht aufgerufen
- Alle anderen Impl-Pakete mit DbContext oder Identity-Stack

### CORS-Konfiguration

Das Api-Projekt hat eine CORS-Policy `"WasmClient"` vorkonfiguriert:

```csharp
builder.Services.AddCors(options =>
    options.AddPolicy("WasmClient", policy =>
        policy.WithOrigins(
                  builder.Configuration["AllowedOrigins"] ?? "https://localhost:7001")
              .AllowAnyHeader()
              .AllowAnyMethod()));
// ...
app.UseCors("WasmClient");
```

`AllowedOrigins` in `appsettings.json` des Api-Projekts:

```json
"AllowedOrigins": "https://localhost:7001"
```

In Produktion: exakte Origin der WASM-App eintragen, kein Wildcard. Wenn Api und Client gemeinsam deployt werden (Api liefert WASM-Dateien per `UseStaticFiles` aus), entfaellt CORS – beide laufen dann auf derselben Origin.

### Nächste Schritte

1. Token konfigurieren (beide Projekte nutzen dieselbe `nuget.config`).
2. `appsettings.json` im Api-Projekt: PostgreSQL-Connection-String + JWT-Konfiguration (Secrets per `dotnet user-secrets` – niemals plain in die Datei).
3. `wwwroot/appsettings.json` im Client-Projekt: `ApiBaseUrl` auf Api-Port setzen.
4. Fachmodule nur im Api-Projekt referenzieren; UI-Pakete nur im Client-Projekt.

---

## bw-wasm

### Wann verwenden?

Wenn das Frontend (Blazor WASM) standalone entwickelt wird und die API bereits existiert oder separat betrieben wird (z.B. ein vorhandenes `bw-api`-Projekt in einem anderen Repo). Kein serverseitiger Code, kein IModule, kein EF Core.

### Scaffolden

```powershell
dotnet new bw-wasm -n MeinClient
```

### Projektstruktur

```
MeinClient/
  src/
    MeinClient.Client/        # Blazor WebAssembly; Program.cs mit WebAssemblyHostBuilder
      Components/
        Layout/MainLayout.razor
        Pages/Home.razor
        Routes.razor
        App.razor
      wwwroot/
        appsettings.json      # Wird vom Browser per HTTP geladen – KEINE Secrets
        index.html
        app.css
  tests/
    MeinClient.Client.Tests/
  nuget.config
```

### Enthaltene SDK-Pakete

Identisch zum Client-Projekt aus `bw-wasm-api`:

| Paket                           | Zweck                                             |
|---------------------------------|---------------------------------------------------|
| `BieberWorks.SDK.UI.MudBlazor`  | `BwThemeProvider`, `ILayoutThemeContext`, UI-Infrastruktur |
| `MudBlazor`                     | `9.*`                                             |

### WASM-spezifische Unterschiede

**`WebAssemblyHostBuilder` statt `WebApplication.CreateBuilder`:**

```csharp
var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");
```

**Kein `AddBieberWorksModules()`** – Module laufen serverseitig. Der Client hat keinen Zugriff auf den Dependency-Graph der Server-Assemblies.

**`AddBieberWorksUi()`** statt `AddBieberWorksModules()` fuer UI-Services:

```csharp
builder.Services.AddBieberWorksUi();
builder.Services.AddMudServices();
```

### ApiBaseUrl konfigurieren

Die Konfiguration liegt unter `wwwroot/appsettings.json` (nicht `appsettings.json` im Projektroot). Diese Datei wird vom Browser via HTTP heruntergeladen – sie ist oeffentlich sichtbar. Niemals Secrets darin ablegen.

```json
{
  "ApiBaseUrl": "https://localhost:5001"
}
```

Das `Program.cs` liest `ApiBaseUrl` und setzt es als `BaseAddress` des `HttpClient`:

```csharp
builder.Services.AddScoped(sp =>
{
    var config = sp.GetRequiredService<IConfiguration>();
    var baseAddress = config["ApiBaseUrl"] ?? builder.HostEnvironment.BaseAddress;
    return new HttpClient { BaseAddress = new Uri(baseAddress) };
});
```

Wenn kein `ApiBaseUrl` gesetzt ist, faellt der Client auf `HostEnvironment.BaseAddress` zurueck – praktisch wenn Api und Client gemeinsam deployt werden.

### Nächste Schritte

1. `wwwroot/appsettings.json`: `ApiBaseUrl` auf die laufende API setzen.
2. Auth aktivieren: `BieberWorks.SDK.Auth.Client` + `BieberWorks.SDK.Auth.UI.MudBlazor` referenzieren, `AddBieberWorksAuthClient()` + `AddAuthorizationCore()` einkommentieren.
3. Eigene Seiten in `Components/Pages/` anlegen.

---

## bw-module

### Wann verwenden?

Wenn eine bestehende Solution (angelegt mit `bw-api` oder `bw-blazor`) um ein weiteres Modul erweitert werden soll. `bw-module` ist ein **Projekt-Template** (`type: project`), kein Solution-Template – es erzeugt nur ein einzelnes `.csproj`, keine Solution-Datei.

### Scaffolden

```powershell
# Im Verzeichnis der bestehenden Solution ausfuehren
dotnet new bw-module -n MeinModul -o src/MeinModul
```

### In Solution einhaengen

Nach dem Scaffolden muss das Projekt manuell in die Solution und den Host aufgenommen werden:

```powershell
# Zur Solution hinzufuegen
dotnet sln MeinProjekt.slnx add src/MeinModul/MeinModul.csproj

# Im Host-Projekt referenzieren (Api oder Web)
dotnet add src/MeinProjekt.Api/MeinProjekt.Api.csproj reference src/MeinModul/MeinModul.csproj
```

Der Host findet das neue Modul automatisch beim naechsten Start, weil `AddBieberWorksModules()` alle geladenen Assemblies nach `IModule`-Implementierungen durchsucht.

### Projektstruktur

```
src/MeinModul/
  MeinModul.csproj             # Referenziert BieberWorks.SDK.Core + Core.Web
  MeinModulModule.cs           # IModule + IEndpointModule – RegisterServices + MapEndpoints
  Features/
    GetItems/
      GetItemsHandler.cs       # Beispiel-Handler (Command/Query-Pattern)
      GetItemsQuery.cs         # Beispiel-Query-Record
  Models/
    MeinModulItem.cs           # Beispiel-Domaenobjekt
```

### Konventionen im generierten Code

- `MeinModulModule.cs` implementiert `IModule` und `IEndpointModule`.
- `RegisterServices()` registriert alle Handler als `AddScoped`.
- `MapEndpoints()` legt eine `MapGroup` mit dem Modul-Namen als Praefix an.
- `DbContext`-Registrierung ist auskommentiert eingebaut – nur aktivieren wenn ein eigener Persistenz-Stack benoetigt wird.
- Eigene `IDomainEventProcessor<T>`-Implementierungen hier als `AddScoped(typeof(IDomainEventProcessor<>), typeof(MeinHandler<>))` registrieren.

---

## Repos anlegen — PowerShell-Modul

Das `BieberWorks.RepoSetup`-PowerShell-Modul erledigt die gesamte Repo-Infrastruktur: GitHub-Repo anlegen, Branches `main`/`staging`/`dev` (Default `dev`), CI-Workflows, `Directory.Build.props`, Solution und Template-Scaffolding.

### Installation (einmalig)

```powershell
# Repository registrieren (PACKAGES_TOKEN = GitHub PAT mit read:packages)
$cred = New-Object PSCredential("BieberWorks", (ConvertTo-SecureString "PACKAGES_TOKEN" -AsPlainText -Force))
Register-PSRepository -Name BieberWorks `
    -SourceLocation "https://nuget.pkg.github.com/BieberWorks/index.json" `
    -InstallationPolicy Trusted -Credential $cred

Install-Module BieberWorks.RepoSetup -Repository BieberWorks -Credential $cred
```

Danach von überall verfügbar — kein fester Aufrufpfad nötig.

### Verfügbare Funktionen

| Funktion | Passendes Template | Was es anlegt |
|---|---|---|
| `New-BwModuleRepo` | `bieberworks-module` | NuGet-Modul-Repo (`*.Contracts` + Impl + Tests), CI/Release-Workflows |
| `New-BwApiRepo` | `bw-api` | API-Host-Repo, Docker-Support, CI-Workflow |
| `New-BwWasmApiRepo` | `bw-wasm-api` | WASM+API-Solution-Repo, CORS vorkonfiguriert |
| `New-BwWasmRepo` | `bw-wasm` | Reines WASM-Client-Repo |
| `New-BwAppRepo` | `bw-blazor` | Blazor Server App-Repo |
| `New-BwBlankRepo` | — | Blanko-Repo (Basis für alles andere) |

### Beispiele

```powershell
# Consumer-App unter p-bieber anlegen, Repo lokal in C:\repos\private\
New-BwAppRepo -RepoName Portfolio -Owner p-bieber -TargetDirectory "C:\repos\private"

# SDK-Modul unter BieberWorks anlegen (erzwingt SDK- Prefix)
New-BwModuleRepo -RepoName SDK-Forum -Owner BieberWorks

# Ohne -TargetDirectory: Repo landet im aktuellen Verzeichnis
New-BwApiRepo -RepoName MyApi -Owner p-bieber
```

### Parameter

Alle Funktionen haben dieselbe Signatur:

| Parameter | Pflicht | Beschreibung |
|---|---|---|
| `-RepoName` | ja | Name des Repos (z.B. `Portfolio`, `SDK-Forum`) |
| `-Owner` | ja | GitHub-Org oder Account (z.B. `BieberWorks`, `p-bieber`) |
| `-TargetDirectory` | nein | Lokaler Zielordner; Standard = aktuelles Verzeichnis |
| `-Public` | nein | Switch — Repo öffentlich anlegen (Standard: privat) |

### Nach der Repo-Anlage — Secrets setzen (PFLICHT)

Ohne diese Secrets schlägt der CI mit 401 fehl:

```powershell
$t = Get-Content "C:\Users\bieber\source\repos\BieberWorks\.secrets.txt"
gh secret set PACKAGES_TOKEN --repo <Owner>/<RepoName> --body ($t | Select-String "^ghp_"        | ForEach-Object { $_.Line.Trim() })
gh secret set DISPATCH_TOKEN --repo <Owner>/<RepoName> --body ($t | Select-String "^github_pat_" | ForEach-Object { $_.Line.Trim() })
```

---

## Token-Konfiguration (BIEBERWORKS_NUGET_TOKEN)


---

## Token-Konfiguration (BIEBERWORKS_NUGET_TOKEN)

Alle Templates enthalten eine `nuget.config` mit der GitHub Packages Quelle der Org `BieberWorks`. Ohne gueltiges Token schlaegt `dotnet restore` mit 401 fehl.

**Einmalig pro Entwickler:**

1. GitHub PAT mit Scope `read:packages` erstellen: https://github.com/settings/tokens/new?scopes=read:packages

2. Umgebungsvariable setzen (Token niemals in `nuget.config` oder `appsettings.json` eintragen):

```powershell
# Fuer die aktuelle Session:
$env:BIEBERWORKS_NUGET_TOKEN = 'ghp_...'

# Dauerhaft (User-Scope, kein Admin noetig):
[System.Environment]::SetEnvironmentVariable('BIEBERWORKS_NUGET_TOKEN', 'ghp_...', 'User')
```

3. `nuget.config` im generierten Projekt: `DEIN_GITHUB_USERNAME` durch den eigenen GitHub-Benutzernamen ersetzen.

Die `nuget.config` liest den Token zur Laufzeit aus der Umgebungsvariable – der Wert landet nie in einer Datei, die versioniert wird.
