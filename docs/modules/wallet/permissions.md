# Permissions — SDK-Wallet

All Wallet permissions follow the format `{module}:{resource}:{action}`.

## Constants

```csharp
// Namespace: BieberWorks.SDK.Wallet.Contracts.Permissions
public static class WalletPermissions
{
    public const string View             = "wallet:balance:view";
    public const string Admin            = "wallet:admin:manage";
    public const string TransactionsView = "wallet:transactions:view";
}
```

## Reference

| Constant | Value | Effect |
|---|---|---|
| `View` | `wallet:balance:view` | Wallet entry visible in the Account shell. Grants access to `/account/wallet` and `/account/wallet/transactions`. |
| `Admin` | `wallet:admin:manage` | Full Admin access: view all wallets, manually top up / adjust balances, manage currencies. Controls all `/admin/wallet/*` pages. |
| `TransactionsView` | `wallet:transactions:view` | Transaction history visible (own transactions for users; all transactions for admins who also hold `wallet:admin:manage`). |

## Assignment

Permissions are assigned to roles via `/admin/users/roles/{roleId}`.
`WalletPermissionContributor` registers all 3 permissions automatically at startup —
no manual entry in the admin panel is required.

## REST Endpoints

| Endpoint | Required Permission |
|---|---|
| `GET /bw/wallet/me` | Authenticated + `wallet:balance:view` |
| `GET /bw/wallet/me/transactions` | Authenticated + `wallet:transactions:view` |
| `GET /bw/wallet/me/holds` | Authenticated + `wallet:balance:view` |
| `POST /bw/wallet/me/holds` | Authenticated + `wallet:balance:view` |
| `DELETE /bw/wallet/me/holds/{holdId}` | Authenticated + `wallet:balance:view` |
| `GET /bw/wallet/admin/*` | `wallet:admin:manage` |
| `POST /bw/wallet/admin/{userId}/topup` | `wallet:admin:manage` |
| `POST /bw/wallet/admin/{userId}/adjust` | `wallet:admin:manage` |
| `POST /bw/wallet/admin/{userId}/holds/{holdId}/commit` | `wallet:admin:manage` |
