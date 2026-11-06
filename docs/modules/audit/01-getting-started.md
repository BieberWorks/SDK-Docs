# Setup & Configuration

## NuGet packages

For a pure backend project (no admin UI):

```bash
dotnet add package BieberWorks.SDK.Audit.Contracts
dotnet add package BieberWorks.SDK.Audit
```

With admin UI (MudBlazor):

```bash
dotnet add package BieberWorks.SDK.Audit.Contracts
dotnet add package BieberWorks.SDK.Audit
dotnet add package BieberWorks.SDK.Audit.UI.Blazor
dotnet add package BieberWorks.SDK.Audit.UI.Blazor.MudBlazor
```

::: info Packages from GitHub Packages
The packages are obtained from the `BieberWorks` GitHub organization. A corresponding `nuget.config` with the `PACKAGES_TOKEN` is required.
:::

## Program.cs

The module registers itself via `AddBieberWorksModules`. No manual `services.Add...` call necessary — `AuditModule.RegisterServices` handles that automatically:

```csharp
builder.Services.AddBieberWorksModules(builder.Configuration);
```

For the admin UI, additionally call `AddAuditUi()`:

```csharp
builder.Services.AddAuditUi();
```

Optionally, `AddAuditUi` can be called with a configuration delegate to enable links in the table:

```csharp
builder.Services.AddAuditUi(options =>
{
    // Render user IDs in the table as links
    options.UserLinkTemplate = "/admin/users/{0}";

    // Link resource IDs by resource type
    options.ResourceLinkTemplates["Role"] = "/admin/users/roles/{0}";
    options.ResourceLinkTemplates["User"] = "/admin/users/{0}";
});
```

Then map endpoints:

```csharp
app.MapBieberWorksModules();
```

And apply migrations on startup:

```csharp
await app.InitializeBieberWorksModulesAsync();
```

## Connection string

The module searches for a connection string in this order:

1. `ConnectionStrings:AuditDb`
2. `ConnectionStrings:DefaultConnection`
3. `ConnectionStrings:AuthDb`

```json
{
  "ConnectionStrings": {
    "AuditDb": "Host=localhost;Database=bieberworks;Username=...;Password=..."
  }
}
```

::: tip Shared database, separate schema
The same PostgreSQL database as other modules can be used. SDK-Audit puts all tables in the `audit` schema and does not collide with other modules.
:::

## PostgreSQL schema `audit`

`AuditModule` implements `IModuleInitializer` and automatically runs `db.Database.MigrateAsync()` on startup. Manual `dotnet ef database update` is optional for production environments, but not required if `InitializeBieberWorksModulesAsync()` is called.

The EF migrations history table is also placed in the `audit` schema:

```
audit.__EFMigrationsHistory
audit.AuditItems
```

## Blazor Router (admin UI only)

For the Blazor router to find pages from the UI package, use `BwRouter` in `Routes.razor` and `AddBwModuleAssemblies` in `Program.cs`. `BwRouter` lives in `BieberWorks.SDK.UI.Blazor.MudBlazor.Routing` (add `@using BieberWorks.SDK.UI.Blazor.MudBlazor.Routing` to `_Imports.razor`). Together with `AddBwModuleAssemblies` on the server it discovers all `BieberWorks.SDK.*` UI assemblies automatically, so no per-module assembly list is needed.


```csharp
// Program.cs
app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode()
    .AddBwModuleAssemblies(typeof(Program).Assembly);
```

```razor
<!-- Routes.razor -->
<BwRouter AppAssembly="typeof(App).Assembly">
    ...
</BwRouter>
```
