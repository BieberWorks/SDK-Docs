# Module Integration — Checkliste

Diese Seite beschreibt Schritt für Schritt, wie ein neues SDK-Modul in einen bestehenden Host eingebunden wird. Alle Cross-Cutting-Concerns (DI, Permissions, Localization, Auditing, UI, Messaging) sind berücksichtigt.

::: info Voraussetzung
Der Host nutzt `AddBieberWorksModules` aus `SDK-Foundation`. Alle Module registrieren sich über `IModule.RegisterServices` selbst — manuelle `services.Add…`-Aufrufe sind nur für optionale Erweiterungen nötig.
:::

## Schritt 1 — NuGet-Pakete hinzufügen

Füge das Modul-Paket und (falls vorhanden) das Contracts-Paket in die Host-`.csproj` ein:

```xml
<!-- Contracts — wird auch von anderen Modulen referenziert -->
<PackageReference Include="BieberWorks.SDK.<ModuleName>.Contracts" Version="0.*-*" />

<!-- Implementierung — nur der Host -->
<PackageReference Include="BieberWorks.SDK.<ModuleName>" Version="0.*-*" />

<!-- UI (optional) — nur wenn MudBlazor-Seiten genutzt werden -->
<PackageReference Include="BieberWorks.SDK.<ModuleName>.UI.MudBlazor" Version="0.*-*" />
```

Alle Pakete kommen aus GitHub Packages der `BieberWorks`-Org. Stelle sicher, dass `nuget.config` den Feed mit einem PAT (Scope `read:packages`) enthält.

## Schritt 2 — `AddBieberWorksModules` reicht für die Basis

`IModule`-Implementierungen werden per Assembly-Scan automatisch entdeckt:

```csharp
// Program.cs
builder.Services.AddBieberWorksModules(builder.Configuration);
```

Das ist der einzige Pflicht-Aufruf. Alles weitere ist modular optional.

## Schritt 3 — Messaging-Infrastruktur sicherstellen

Wenn das Modul Commands/Queries über `IAppMessageDispatcher` versendet oder `IDomainEventProcessor<T>` registriert, muss Messaging aktiv sein:

```csharp
// Program.cs — einmalig für den gesamten Host
builder.Services.AddBieberWorksMessaging();
```

::: tip Idempotent
`AddBieberWorksMessaging()` kann mehrfach aufgerufen werden — nachfolgende Aufrufe sind No-Ops.
:::

### Handler im Modul registrieren

Jeder Command-/Query-Handler muss in der `*Module.cs` des Moduls explizit registriert werden:

```csharp
// In MyModule.RegisterServices()
services.AddScoped<
    IAppMessageRequestHandler<MyCommand, Result<Guid>>,
    MyCommandHandler>();

// Domain-Event-Processor
services.AddScoped<
    IDomainEventProcessor<MyDomainEvent>,
    MyDomainEventProcessor>();
```

## Schritt 4 — Permissions registrieren (falls das Modul Permissions definiert)

Wenn das Modul eigene Permissions schützt, implementiere `IPermissionContributor` und registriere ihn als Singleton. Das Auth-Modul liest alle Contributors beim Start aus:

```csharp
// In MyModule.RegisterServices()
services.AddSingleton<IPermissionContributor, MyModulePermissionContributor>();
```

```csharp
// MyModulePermissionContributor.cs
public sealed class MyModulePermissionContributor : IPermissionContributor
{
    public IEnumerable<PermissionDefinition> GetPermissions()
    {
        yield return new PermissionDefinition(
            Key:         "mymodule:resource:read",
            DisplayName: "Resource anzeigen",
            Module:      "MyModule",
            Group:       "Resource");

        yield return new PermissionDefinition(
            Key:         "mymodule:resource:manage",
            DisplayName: "Resource verwalten",
            Module:      "MyModule",
            Group:       "Resource");
    }
}
```

Anschließend die Permission in der Admin-UI der Admin-Rolle zuweisen (`/admin/roles`).

::: warning Auth-Modul Pflicht
`IPermissionContributor` ist ein Vertrag aus `BieberWorks.SDK.Auth.Contracts`. Das Auth-Modul muss im Host installiert sein, damit die Contributors verarbeitet werden.
:::

## Schritt 5 — Auto-Auditing aktivieren (falls Domain-Events auditiert werden sollen)

Installiere `SDK-Audit` im Host. Kein weiterer Code im Fachmodul nötig — das Event muss nur `IAuditableEvent` implementieren:

```csharp
// MyDomainEvent.cs — im Contracts-Paket des Moduls
using BieberWorks.SDK.SharedKernel;

public sealed record MyResourceCreatedEvent(
    Guid ResourceId,
    string ActorId) : IAuditableEvent
{
    public string  AuditAction     => "mymodule:resource:created";
    public string  AuditResource   => "Resource";
    public string? AuditResourceId => ResourceId.ToString();
    public string? AuditUserId     => ActorId;
    public string? AuditDetails    => null;
}
```

Der Open-Generic-Handler `AuditableEventHandler<TEvent>` in SDK-Audit übernimmt den Rest automatisch.

::: info Nur SharedKernel-Referenz nötig
`IAuditableEvent` lebt in `BieberWorks.SDK.SharedKernel`. Das Fachmodul braucht keine Abhängigkeit auf `BieberWorks.SDK.Audit` oder `BieberWorks.SDK.Audit.Contracts`.
:::

## Schritt 6 — Localization hinzufügen (falls das Modul lokalisierbare Texte hat)

### resx-Dateien anlegen

Lege pro Modul eine oder mehrere Resource-Dateien an:

```
src/MyModule.Contracts/Resources/
    MyModuleResources.resx        ← Neutral/Englisch
    MyModuleResources.de.resx     ← Deutsch
```

### IStringLocalizer in Komponenten verwenden

```csharp
[Inject] IStringLocalizer<MyModuleResources> Loc { get; set; } = default!;

string label = Loc["MyModule_Label_Title"];
```

### Key-Discovery konfigurieren (für Admin-UI-Übersetzungseditor)

Damit SDK-Localization die Keys des Moduls im Translation-Editor anzeigt, muss der Assembly-Prefix bekannt gemacht werden. Das geschieht einmalig im Host:

```csharp
// Program.cs
builder.Services.Configure<LocalizationScanOptions>(options =>
{
    // Nötig für Assemblies, deren Name NICHT mit "BieberWorks.SDK." beginnt:
    options.AdditionalAssemblyPrefixes.Add("MyApp.");

    // Optionaler Anzeigename im Translation-Editor:
    options.SetDisplayName("MyModule", "Mein Modul");
});
```

::: tip BieberWorks.SDK.*-Assemblies
Assemblies mit dem Prefix `BieberWorks.SDK.` werden automatisch gescannt — kein Eintrag in `AdditionalAssemblyPrefixes` nötig.
:::

## Schritt 7 — UI-Assembly-Wiring (falls das Modul Razor-Seiten enthält)

Wenn das Modul ein `*.UI.MudBlazor`-Paket liefert, müssen dessen Seiten dem Blazor-Router bekannt gemacht werden. **Beide** Stellen müssen aktualisiert werden:

### Program.cs

```csharp
builder.Services
    .AddRazorComponents()
    .AddInteractiveServerComponents()
    .AddAdditionalAssemblies(
        typeof(BieberWorks.SDK.MyModule.UI.MudBlazor.SomeAnchorType).Assembly,
        // weitere Modul-Assemblies...
    );
```

### Routes.razor

```razor
@code {
    private static readonly Assembly[] _moduleAssemblies =
    [
        typeof(BieberWorks.SDK.MyModule.UI.MudBlazor.SomeAnchorType).Assembly,
        // weitere...
    ];
}

<BwThemeProvider>
    <Router AppAssembly="@typeof(App).Assembly"
            AdditionalAssemblies="@_moduleAssemblies">
        <Found Context="routeData">
            <RouteView RouteData="@routeData" DefaultLayout="@typeof(MainLayout)" />
            <FocusOnNavigate RouteData="@routeData" Selector="h1" />
        </Found>
    </Router>
</BwThemeProvider>
```

::: warning BwThemeProvider
`BwThemeProvider` muss genau einmal in `Routes.razor` existieren — nicht in einzelnen Layouts. Andernfalls wird der Theme-Zustand bei jedem Navigationswechsel zurückgesetzt.
:::

### Admin-Shell-Integration (IAdminSection)

Wenn das Modul Admin-Seiten unter dem Admin-Shell anzeigen soll:

```csharp
// In MyModule.RegisterServices()
services.AddSingleton<IAdminSection, MyModuleAdminSection>();
```

### Account-Shell-Integration (IAccountSection)

Analog für Account-bezogene Seiten:

```csharp
// In MyModule.RegisterServices()
services.AddSingleton<IAccountSection, MyModuleAccountSection>();
```

## Schritt 8 — Migrations und Startup

Wenn das Modul einen eigenen `DbContext` hat, implementiere `IModuleInitializer`:

```csharp
public sealed class MyModule : IModule, IModuleInitializer
{
    public string Name => "MyModule";

    public IServiceCollection RegisterServices(
        IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<MyDbContext>(opts =>
            opts.UseNpgsql(
                configuration.GetConnectionString("DefaultConnection")));
        // ...
        return services;
    }

    public async Task InitializeAsync(
        IServiceProvider serviceProvider,
        CancellationToken cancellationToken = default)
    {
        var db = serviceProvider.GetRequiredService<MyDbContext>();
        await db.Database.MigrateAsync(cancellationToken);
    }
}
```

`InitializeBieberWorksModulesAsync()` im Host ruft alle `IModuleInitializer` in einem eigenen DI-Scope auf:

```csharp
// Program.cs
await app.InitializeBieberWorksModulesAsync();
```

## Komplette Program.cs — Referenz

```csharp
using BieberWorks.SDK.Admin.UI.MudBlazor.Extensions;
using BieberWorks.SDK.Audit.UI.MudBlazor.Extensions;
using BieberWorks.SDK.Localization.UI.MudBlazor.Extensions;
using BieberWorks.SDK.Settings.UI.MudBlazor.Extensions;
using BieberWorks.SDK.UI.MudBlazor.Extensions;

var builder = WebApplication.CreateBuilder(args);

// 1. Alle IModule automatisch laden (Foundation, Auth, Email, Audit, Localization, Settings, …)
builder.Services.AddBieberWorksModules(builder.Configuration);

// 2. Messaging-Infrastruktur
builder.Services.AddBieberWorksMessaging();

// 3. UI-Pakete (Reihenfolge: UI zuerst)
builder.Services.AddBieberWorksUi();
builder.Services.AddBieberWorksAdmin();
builder.Services.AddBieberWorksAccount();  // falls genutzt

// 4. Optionale Modul-UIs
builder.Services.AddAuditUi();
builder.Services.AddLocalizationUi();
builder.Services.AddSettingsUi();

// 5. Blazor + alle Modul-Assemblies
builder.Services
    .AddRazorComponents()
    .AddInteractiveServerComponents()
    .AddAdditionalAssemblies(
        typeof(BieberWorks.SDK.UI.MudBlazor.Components.BwThemeProvider).Assembly,
        typeof(BieberWorks.SDK.Admin.UI.MudBlazor.AdminModule).Assembly,
        typeof(BieberWorks.SDK.Auth.UI.MudBlazor._Imports).Assembly,
        typeof(BieberWorks.SDK.Audit.UI.MudBlazor._Imports).Assembly,
        typeof(BieberWorks.SDK.Localization.UI.MudBlazor.AdminSection.LocalizationAdminSection).Assembly,
        typeof(BieberWorks.SDK.Settings.UI.MudBlazor.AdminSection.SettingsAdminSection).Assembly
        // + eigene Modul-Assemblies
    );

var app = builder.Build();

app.UseAuthentication();
app.UseAuthorization();

// 6. Migrations + Startup-Tasks aller IModuleInitializer
await app.InitializeBieberWorksModulesAsync();

// 7. Endpoints aller IEndpointModule mappen
app.MapBieberWorksModules();
app.MapRazorComponents<App>()
   .AddInteractiveServerRenderMode();

await app.RunAsync();
```

## Checkliste

| # | Aufgabe | Gilt wenn |
|---|---|---|
| 1 | NuGet-Pakete (`*.Contracts` + Impl + optional `*.UI.MudBlazor`) hinzufügen | immer |
| 2 | `AddBieberWorksModules` im Host vorhanden | immer |
| 3 | `AddBieberWorksMessaging` im Host vorhanden | Modul hat Handler/Processors |
| 4 | Handler in `Module.cs` als `IAppMessageRequestHandler<…>` registriert | Modul hat Command-/Query-Handler |
| 5 | EventProcessor in `Module.cs` als `IDomainEventProcessor<…>` registriert | Modul hat Event-Prozessoren |
| 6 | `IPermissionContributor` registriert und Permission in Admin-Rolle vergeben | Modul schützt Seiten/Endpoints |
| 7 | Domain-Events implementieren `IAuditableEvent` | Modul soll auditiert werden |
| 8 | `resx`-Dateien angelegt; `AdditionalAssemblyPrefixes` konfiguriert | Modul hat lokalisierbare Texte |
| 9 | Assembly in `Program.cs` (`AddAdditionalAssemblies`) eingetragen | Modul hat Razor-Seiten |
| 10 | Assembly in `Routes.razor` (`AdditionalAssemblies`) eingetragen | Modul hat Razor-Seiten |
| 11 | `IAdminSection` registriert | Modul hat Admin-Seiten |
| 12 | `IAccountSection` registriert | Modul hat Account-Seiten |
| 13 | `IModuleInitializer` implementiert; `InitializeBieberWorksModulesAsync` aufgerufen | Modul hat DbContext/Migrations |
