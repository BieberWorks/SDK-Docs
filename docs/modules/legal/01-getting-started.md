# Getting Started

## 1. Register services

```csharp
// Program.cs
builder.Services.AddLegalModule(builder.Configuration, o =>
{
    o.Cultures = ["en", "de"];
    // Documents is optional — the four default entries below are pre-configured.
    // Only set this array when you need to change behaviour (versioned/requireConsent)
    // or add custom documents. If you do override it, always re-include the defaults
    // you still need; replacing the array removes any entry not listed.
    // Note: defaultRoute must match the URL segment users navigate to. The SDK
    // registers literal Blazor routes /terms, /privacy, /imprint, /withdrawal using
    // the document keys as path segments — if your defaultRoute differs from the key
    // (e.g. "agb" instead of "terms"), only /legal/{key} will resolve correctly
    // for that document; the literal /terms route will fall back via the key name.
    o.Documents =
    [
        new LegalDocumentOptions(LegalDocumentKeys.Terms,      versioned: true,  requireConsent: true,  defaultRoute: "terms"),
        new LegalDocumentOptions(LegalDocumentKeys.Privacy,    versioned: true,  requireConsent: false, defaultRoute: "privacy"),
        new LegalDocumentOptions(LegalDocumentKeys.Imprint,    versioned: false, requireConsent: false, defaultRoute: "imprint"),
        new LegalDocumentOptions(LegalDocumentKeys.Withdrawal, versioned: true,  requireConsent: false, defaultRoute: "withdrawal"),
    ];
});
builder.Services.AddLegalUi();
```

## 2. Add to router (Blazor)

```csharp
// Program.cs (MapRazorComponents)
app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode()
    .AddAdditionalAssemblies(typeof(BieberWorks.SDK.Legal.UI.Blazor.MudBlazor.LegalUiMudBlazorModule).Assembly);
```

```razor
// Routes.razor (Router tag)
<Router AppAssembly="@typeof(App).Assembly"
        AdditionalAssemblies="@(new[] { typeof(BieberWorks.SDK.Legal.UI.Blazor.MudBlazor.LegalUiMudBlazorModule).Assembly })">
```

## 3. Initialize (migrations + seeding)

```csharp
// Program.cs (after app.Build())
await app.Services.InitializeModulesAsync(); // calls LegalModule.InitializeAsync
```

## 4. Connection string

The module reads `DefaultConnection` from `IConfiguration` (same as other SDK modules).

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Database=bieberworks;Username=postgres;Password=postgres"
  }
}
```
