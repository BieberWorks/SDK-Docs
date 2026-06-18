# Getting Started

## Prerequisites

- .NET 10 SDK
- PostgreSQL
- NuGet feed access to `BieberWorks` GitHub Packages

## Installation

Add the BieberWorks GitHub Packages feed to your `nuget.config`:

```xml
<packageSources>
  <add key="bieberworks" value="https://nuget.pkg.github.com/BieberWorks/index.json" />
</packageSources>
<packageSourceCredentials>
  <bieberworks>
    <add key="Username" value="YOUR_GITHUB_USERNAME" />
    <add key="ClearTextPassword" value="YOUR_PAT_WITH_READ_PACKAGES" />
  </bieberworks>
</packageSourceCredentials>
```

## Minimal Setup

Install Foundation:

```bash
dotnet add package BieberWorks.SDK.Core
dotnet add package BieberWorks.SDK.Core.Web
```

Wire up in `Program.cs`:

```csharp
builder.Services.AddBieberWorksModules(builder.Configuration);
// ...
app.MapBieberWorksModules();
await app.InitializeBieberWorksModulesAsync();
```

## Next Steps

- [Auth Module](/modules/auth/)
- [Storage Module](/modules/storage/)
