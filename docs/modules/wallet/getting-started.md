# SDK-Wallet — Getting Started

## Installation

Add the packages to your host project:

```xml
<!-- Core wallet logic + REST endpoints -->
<PackageReference Include="BieberWorks.SDK.Wallet" Version="1.*-*" />

<!-- Optional: Admin + Account UI (MudBlazor) -->
<PackageReference Include="BieberWorks.SDK.Wallet.UI.MudBlazor" Version="1.*-*" />

<!-- Consumer modules reference ONLY contracts, never the implementation -->
<PackageReference Include="BieberWorks.SDK.Wallet.Contracts" Version="1.*-*" />
```

## Program.cs Registration

```csharp
// Registers WalletModule automatically via IModule discovery.
builder.Services.AddBieberWorksModules(builder.Configuration);

// If using the UI package, register the sections:
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

## Connection String

```json
{
  "ConnectionStrings": {
    "WalletDb": "Host=localhost;Database=mydb;Username=postgres;Password=..."
  }
}
```

If `WalletDb` is absent, `DefaultConnection` is used as a fallback.

## Permissions Setup

Wallet uses BieberWorks permission-based access control.
The `WalletPermissionContributor` is registered automatically by `WalletModule`.

Assign permissions to roles via `/admin/users/roles`:

| Permission | Effect |
|---|---|
| `wallet:balance:view` | Wallet entry visible in the Account area; grants access to `/account/wallet` |
| `wallet:admin:manage` | Full Admin access: view all wallets, top up, adjust, manage currencies |
| `wallet:transactions:view` | Transaction history visible (own for user, all for admins with `wallet:admin:manage`) |

## Optional: NullWalletService

Consumer modules can optionally depend on Wallet:

```csharp
// Host without SDK-Wallet:
services.TryAddScoped<IWalletService, NullWalletService>();
// → all methods return Result.Failure("wallet:not_configured")
```

## Further Reading

- [Module Overview & Packages](./index.md)
- [Currencies](./currencies.md)
- [Permissions](./permissions.md)
- [Wallet Service API](./wallet-service.md)
- [GDPR / Privacy](./gdpr-privacy.md)
