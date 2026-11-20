# Installation

## NuGet Packages

Packages are published to the BieberWorks GitHub Packages feed (private). Add the feed to `nuget.config`:

```xml
<packageSources>
  <add key="bieberworks" value="https://nuget.pkg.github.com/BieberWorks/index.json" />
</packageSources>
<packageSourceCredentials>
  <bieberworks>
    <add key="Username" value="GITHUB_USER" />
    <add key="ClearTextPassword" value="PACKAGES_TOKEN" />
  </bieberworks>
</packageSourceCredentials>
```

Then add the packages:

```
dotnet add package BieberWorks.SDK.Notifications
dotnet add package BieberWorks.SDK.Notifications.UI.Blazor.MudBlazor   # optional: Blazor UI
dotnet add package BieberWorks.SDK.Notifications.Client          # WASM / remote consumers only
```

## Program.cs (API/Blazor Host)

```csharp
// Register all BieberWorks modules (including Notifications) from assemblies:
builder.Services.AddBieberWorksModules(builder.Configuration);

// Register Notifications UI components (Bell, AccountSection, AdminSection):
builder.Services.AddNotificationsUi();

// After builder.Build():
app.MapBieberWorksModules();

// Map the SignalR hub:
app.MapHub<NotificationHub>("/hubs/notifications");

// Apply EF migrations (including notifications schema):
await app.InitializeBieberWorksModulesAsync();
```

## Routes.razor

Use `BwRouter` and `AddBwModuleAssemblies` (the `UI.MudBlazor` assembly is discovered automatically):

```razor
@* Routes.razor *@
<BwRouter AppAssembly="typeof(App).Assembly">
    ...
</BwRouter>
```

```csharp
// Program.cs
app.MapRazorComponents<App>()
   .AddInteractiveServerRenderMode()
   .AddBwModuleAssemblies(typeof(Program).Assembly);
```

## AppBar Widget

Place the `NotificationBell` inside your AppBar (e.g. inside `SDK-UI` `AppBarRight` slot):

```razor
<NotificationBell />
```

The component requires authentication state to be available (`AuthenticationStateProvider`).

## WASM / Remote Consumer (Blazor WebAssembly)

For hosts that cannot use the in-process adapter (WASM, standalone API consumers), use the
`BieberWorks.SDK.Notifications.Client` package instead of `BieberWorks.SDK.Notifications`:

```csharp
// Program.cs (WASM)
var apiBase = builder.Configuration["ApiBaseUrl"] ?? builder.HostEnvironment.BaseAddress;
builder.Services.AddBieberWorksNotificationsClient(apiBase);
```

This registers `HttpNotificationsClient` (built on `BwHttpClientBase`, registered with `AddBwHttpClient`)
as `INotificationsClient` and `NullNotificationsHubTokenProvider` as `INotificationsHubTokenProvider`.
The host must provide an `IErrorLocalizer`.

### Real-time Bell push in WASM

The Bell connects to the SignalR hub only when a non-`None` hub token provider is registered.
With `NullNotificationsHubTokenProvider` (the default), the Bell shows the initial-load summary
but does not receive real-time pushes. To enable real-time push, implement
`INotificationsHubTokenProvider` returning `NotificationsHubAuthMode.Bearer` and supply
a `Func<Task<string?>>` that reads the Bearer token from your WASM auth storage:

```csharp
builder.Services.AddBieberWorksNotificationsClient(apiBase,
    sp => new MyWasmBearerHubTokenProvider(sp.GetRequiredService<IYourTokenStore>()));
```

The server-side module automatically configures JwtBearer `OnMessageReceived` to accept
the token from the `access_token` query string for the `/hubs/notifications` path.

## Host-agnostic access

The UI base classes (`NotificationBellBase`, `NotificationsInboxPageBase`, `NotificationsAdminPageBase`)
inject `INotificationsClient` — not the server-only `INotificationsService`.

| Host | Registration | userId handling |
|------|-------------|----------------|
| Blazor Server | Auto via `NotificationsModule` → `InProcNotificationsClient` | Resolved from `ICurrentPrincipalAccessor` (no `IHttpContextAccessor` dependency) |
| WASM | `AddBieberWorksNotificationsClient(baseUrl)` → `HttpNotificationsClient` | Server derives from cookie/JWT; never sent on the wire |

If you subclassed `NotificationBellBase`, `NotificationsInboxPageBase`, or
`NotificationsAdminPageBase` and referenced the old `NotificationsSvc` property, rename it to
`NotificationsClient` and update the call signatures (userId parameter removed).
