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

### Persisting the choice for authenticated users — IUserCultureSyncHook

The endpoint only writes the culture cookie itself; it has no notion of a per-user
language preference stored in a domain module (e.g. Auth). To bridge that gap without
Foundation depending on any domain module, `MapBieberWorksCultureEndpoint()` resolves an
optional `IUserCultureSyncHook` from the request's `IServiceProvider` and invokes it
whenever the request is authenticated:

```csharp
namespace BieberWorks.SDK.SharedKernel.Localization;

public interface IUserCultureSyncHook
{
    Task OnCultureChangedAsync(string userId, string culture, CancellationToken ct = default);
}
```

Behavior:

- **Optional** — resolved via `IServiceProvider.GetService<T>()`. If no implementation is
  registered, the endpoint remains a no-op beyond writing the cookie (unchanged behavior).
- **Authenticated only** — invoked only when `HttpContext.User.Identity.IsAuthenticated` is
  `true`. The user id is read from the `ClaimTypes.NameIdentifier` claim (falling back to
  `sub`); if neither claim is present, the hook is skipped.
- **Fire-and-forget** — the call runs on `Task.Run(...)` and is **not** awaited before the
  redirect is returned. It uses `CancellationToken.None` because the originating request
  scope may already be disposed by the time the background task runs.
- **Must not throw across the boundary** — implementations are expected to catch and log
  their own exceptions. `MapBieberWorksCultureEndpoint` also wraps the call in a try/catch
  and logs a warning (`IUserCultureSyncHook failed to persist culture '{Culture}' for user
  '{UserId}'.`) if an implementation lets an exception escape, but implementations should
  not rely on that as their primary error handling.

A domain module registers an implementation to persist the preference, for example:

```csharp
services.AddScoped<IUserCultureSyncHook, MyModuleUserCultureSyncHook>();
```

See the Auth module's documentation for a concrete implementation
(`AuthUserCultureSyncHook`) that writes the culture onto the Auth user record.

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

## Module error messages (IErrorLocalizer)

`IErrorLocalizer` turns a `DomainError.Code` into a user-facing, localized message. The resource key is
`Error_<Code>` with every `.` replaced by `_`, for example `Identity.Login.EmailNotConfirmed` becomes
`Error_Identity_Login_EmailNotConfirmed`.

Core.Web ships only the generic `Error_Generic_Unexpected`. A module contributes its own texts by shipping a
resource marker type with `.resx` (English, default) and `.de.resx` files and registering it:

```csharp
// Auth/Resources/AuthErrorResources.cs  (+ AuthErrorResources.resx, AuthErrorResources.de.resx)
public sealed class AuthErrorResources;

// in the module's service registration
services.AddErrorResources<AuthErrorResources>();
```

Behavior of `LayeredErrorLocalizer`:

- Registered sources are queried in registration order; the first hit wins. The Core `ErrorResources` come last.
- If no source knows the key, a warning is logged and the generic message is returned (the raw code is never shown).
- Localizers are created through `IStringLocalizerFactory`, so the optional DB override layer (`ITranslationStore`)
  applies automatically. The module name used for overrides is derived from the marker type namespace
  (`BieberWorks.SDK.<Module>.…` → `<Module>`).
- `AddErrorResources<T>()` may be called several times; registering the same type twice is idempotent. The call order
  relative to `AddBieberWorksLocalization` does not matter.
- Every key must exist in all shipped languages; do not keep keys that no code references.
