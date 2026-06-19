# SDK-Notifications — Installation

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
dotnet add package BieberWorks.SDK.Notifications.UI.MudBlazor   # optional: Blazor UI
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

`AddBwModuleAssemblies` auto-discovers the Notifications UI assembly. If using manual assembly registration instead:

```razor
@* Routes.razor *@
<BwThemeProvider>
<Router AppAssembly="typeof(App).Assembly"
        AdditionalAssemblies="new[] { typeof(BieberWorks.SDK.Notifications.UI.MudBlazor.NotificationBell).Assembly }">
    ...
</Router>
</BwThemeProvider>
```

## AppBar Widget

Place the `NotificationBell` inside your AppBar (e.g. inside `SDK-UI` `AppBarRight` slot):

```razor
<NotificationBell />
```

The component requires authentication state to be available (`AuthenticationStateProvider`).

::: tip Automatic AppBar integration
If using `AdminLayout` or `AccountLayout` from SDK-Admin / SDK-Account, the `NotificationBell` is registered as an `IAppBarWidget` automatically by `AddNotificationsUi()` — no manual placement needed.
:::
