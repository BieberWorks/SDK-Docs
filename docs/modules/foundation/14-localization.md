# Localization

`BieberWorks.SDK.Core.Web` provides a layered localization system that chains a DB-backed override store (optional) in front of the standard ASP.NET Core `.resx` pipeline. Modules ship `.resx` files as the default; an operator can override individual keys at runtime via SDK-Localization without touching source code.

## Architecture

```
Request
  │
  ▼
IStringLocalizer<T>    (resolved via LayeredStringLocalizerFactory)
  │
  ├─ 1. ITranslationStore.GetAsync()    (DB / cache layer — optional; null = skip)
  │       └─ Returns a translated string from the database if present
  │
  └─ 2. ResourceManagerStringLocalizer  (standard .resx fallback)
```

`ITranslationStore` is defined in `BieberWorks.SDK.SharedKernel.Localization`. When no implementation is registered, the factory falls back silently to `.resx`.

## Setup

### 1. Register in Program.cs

```csharp
builder.Services.AddBieberWorksLocalization("en", "de");
```

The first culture is the default. When called with no arguments, `["en", "de"]` is the default list. Additional BCP 47 culture names can be appended:

```csharp
builder.Services.AddBieberWorksLocalization("en", "de", "fr");
```

`AddBieberWorksLocalization` performs the following registrations:

| Step | What happens |
|---|---|
| Calls `AddLocalization()` | Registers the built-in `ResourceManagerStringLocalizerFactory` |
| Replaces `IStringLocalizerFactory` | Installs `LayeredStringLocalizerFactory` as a decorator |
| Registers `ILanguageService` | Scoped — resolves the current request culture |
| Configures `RequestLocalizationOptions` | Sets default culture, supported cultures, and cookie + Accept-Language providers |

### 2. Activate the middleware

```csharp
app.UseBieberWorksLocalization();   // after UseRouting(), before UseAuthorization()
```

### 3. Map the culture-cookie endpoint

```csharp
app.MapBieberWorksCultureEndpoint();
```

This registers a `GET /bw/set-culture` endpoint that writes a persistent culture-preference cookie (`BieberWorks.Culture`) and redirects. Call it from a Blazor component:

```csharp
// Force-reload is required on Blazor Server (SignalR circuit must restart for the new culture to take effect)
Nav.NavigateTo($"/bw/set-culture?culture=de&redirectUri=/", forceLoad: true);
```

## ILanguageService

`ILanguageService` (in `BieberWorks.SDK.SharedKernel.Localization`) exposes the current request culture. Inject it wherever you need the active culture outside of a standard `IStringLocalizer` flow:

```csharp
public interface ILanguageService
{
    CultureInfo CurrentCulture { get; }
    IReadOnlyList<CultureInfo> SupportedCultures { get; }
}
```

`LocalizedText.Get(ILanguageService)` accepts an `ILanguageService` directly — the preferred way to resolve multilingual value objects in services and Blazor components.

## ITranslationStore

`ITranslationStore` (in `BieberWorks.SDK.SharedKernel.Localization`) is the contract for DB-backed overrides:

```csharp
public interface ITranslationStore
{
    Task<string?> GetAsync(string resourceType, string key, string culture,
                           CancellationToken ct = default);
}
```

Register an implementation (e.g. from SDK-Localization) to enable runtime key overrides:

```csharp
services.AddScoped<ITranslationStore, DbTranslationStore>();
```

When the store returns `null` for a key+culture combination, `LayeredStringLocalizerFactory` falls through to the `.resx` resource.

## Adding .resx files to a module

Each module ships its own `.resx` file alongside its source assembly. Inject `IStringLocalizer<T>` where `T` is the resource class (or the module class):

```csharp
public sealed class AuthModule(IStringLocalizer<AuthModule> localizer) : IModule
{
    // ...
}
```

Resource files live in the project root and follow the standard ASP.NET Core convention:

```
AuthModule.resx          (default / English)
AuthModule.de.resx       (German)
```

Set `Build Action = Embedded Resource` on each `.resx` file.
