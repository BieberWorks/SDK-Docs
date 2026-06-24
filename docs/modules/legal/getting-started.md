# Getting Started

## 1. Register services

```csharp
// Program.cs
builder.Services.AddLegalModule(builder.Configuration, o =>
{
    o.Cultures = ["en", "de"];
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
    .AddAdditionalAssemblies(typeof(BieberWorks.SDK.Legal.UI.MudBlazor.LegalUiMudBlazorModule).Assembly);
```

```razor
// Routes.razor (Router tag)
<Router AppAssembly="@typeof(App).Assembly"
        AdditionalAssemblies="@(new[] { typeof(BieberWorks.SDK.Legal.UI.MudBlazor.LegalUiMudBlazorModule).Assembly })">
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
