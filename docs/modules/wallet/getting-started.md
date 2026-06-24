# SDK-Wallet — Getting Started

## Installation

Add the packages to your host project:

```xml
<!-- Core wallet logic + REST endpoints -->
<PackageReference Include="BieberWorks.SDK.Wallet" Version="0.*-*" />

<!-- Optional: Admin + Account UI (MudBlazor) -->
<PackageReference Include="BieberWorks.SDK.Wallet.UI.MudBlazor" Version="0.*-*" />

<!-- Consumer modules reference ONLY contracts, never the implementation -->
<PackageReference Include="BieberWorks.SDK.Wallet.Contracts" Version="0.*-*" />
```

## Program.cs Registration

```csharp
// Registers WalletModule automatically via IModule discovery.
builder.Services.AddBieberWorksModules(builder.Configuration);

// If using the UI package, register the section:
builder.Services.AddSingleton<IAdminSection, WalletAdminSection>();
builder.Services.AddSingleton<IAccountSection, WalletAccountSection>();

// Add assembly to Razor component router:
app.MapRazorComponents<App>()
   .AddAdditionalAssemblies(
       typeof(BieberWorks.SDK.Wallet.UI.MudBlazor._Imports).Assembly);
```

```razor
<!-- Routes.razor -->
<Router AppAssembly="@typeof(App).Assembly"
        AdditionalAssemblies="new[] { typeof(BieberWorks.SDK.Wallet.UI.MudBlazor._Imports).Assembly }">
```

## ConnectionString

```json
{
  "ConnectionStrings": {
    "WalletDb": "Host=localhost;Database=mydb;Username=postgres;Password=..."
  }
}
```

Falls `WalletDb` fehlt, wird `DefaultConnection` als Fallback genutzt.

## Permissions Setup

Wallet uses BieberWorks permission-based access control.
The `WalletPermissionContributor` is registered automatically by `WalletModule`.

Assign permissions to roles via `/admin/users/roles`:

| Permission | Bedeutung |
|---|---|
| `wallet:wallet:view` | Wallet sichtbar im Account-Bereich |
| `wallet:wallet:topup` | Auflade-Seite sichtbar |
| `wallet:wallet:admin` | Admin-Bereich vollständig |
| `wallet:transactions:view` | Transaktionshistorie einsehbar |

## Further Reading

- [Currencies](./currencies.md)
- [Permissions](./permissions.md)
- [Wallet Service API](./wallet-service.md)
- [GDPR / Privacy](./gdpr-privacy.md)

## Optional: NullWalletService

Consumer-Module können optional von Wallet abhängen:

```csharp
// Host ohne SDK-Wallet:
services.TryAddScoped<IWalletService, NullWalletService>();
// → alle Methoden geben Result.Failure("wallet:not_configured") zurück
```
