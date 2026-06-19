# Getting Started — SDK-Pages

## NuGet packages

```xml
<!-- Host .csproj -->
<PackageReference Include="BieberWorks.SDK.Pages" Version="0.*-*" />
<PackageReference Include="BieberWorks.SDK.Pages.UI.MudBlazor" Version="0.*-*" />
```

Other modules that only need to register an `IPageProvider` or inject `IPageService`:

```xml
<PackageReference Include="BieberWorks.SDK.Pages.Contracts" Version="0.*-*" />
```

## Program.cs

`PagesModule` implements `IModule` and is discovered automatically by `AddBieberWorksModules`. The admin UI must be added separately via `AddPagesUi()`.

```csharp
using BieberWorks.SDK.Pages.Extensions;
using BieberWorks.SDK.Pages.UI.MudBlazor.Extensions;

// Option A — default route prefix /p/{slug}
builder.Services.AddBieberWorksModules(builder.Configuration);
builder.Services.AddPagesUi();

// Option B — custom route prefix or conflict validator
builder.Services.AddPagesModule(builder.Configuration, o =>
{
    o.RoutePrefix = "";                          // public pages at /{slug}
    o.RouteConflictValidator = slug =>
        ReservedRoutes.Contains(slug)
            ? $"Route /{slug} is already reserved by the application."
            : null;
});
builder.Services.AddPagesUi();
```

### Assembly registration (Blazor router)

Both `MapRazorComponents` and `Routes.razor` need the Pages assembly:

```csharp
// Program.cs
app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode()
    .AddAdditionalAssemblies(
        typeof(BieberWorks.SDK.Pages.UI.MudBlazor.Pages.PagesListPage).Assembly);
```

```razor
<!-- Routes.razor -->
<Router AppAssembly="typeof(App).Assembly"
        AdditionalAssemblies="new[]
        {
            typeof(BieberWorks.SDK.Pages.UI.MudBlazor.Pages.PagesListPage).Assembly
        }">
```

## appsettings.json

The module resolves the connection string in this order: `PagesDb` → `DefaultConnection`.

```json
{
  "ConnectionStrings": {
    "PagesDb": "Host=localhost;Database=myapp;Username=myuser;Password=secret"
  }
}
```

## Migrations

Migrations are applied automatically on startup via `IModuleInitializer.InitializeAsync`. After migration, registered `IPageProvider` instances are seeded idempotently.

**PostgreSQL schema:** `pages`

## Assembly discovery

The Blazor router must be told about the Pages assembly so it can discover `PublicPage.razor` (route `/p/{slug}`) and the admin pages. This is handled by the `AddAdditionalAssemblies` call above — no manual route registration needed.

The seeding of `IPageProvider` implementations is also automatic: any `IPageProvider` registered in DI before `InitializeBieberWorksModulesAsync()` is called will have its pages seeded.

```csharp
// Register a page provider from another module:
builder.Services.AddSingleton<IPageProvider, MyLegalPageProvider>();
```

See [page-provider.md](page-provider.md) for the full `IPageProvider` contract.
