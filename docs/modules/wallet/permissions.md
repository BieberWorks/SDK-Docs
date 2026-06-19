# Permissions — SDK-Wallet

Alle Wallet-Permissions folgen dem Format `{module}:{resource}:{action}`.

## Konstanten

```csharp
// Namespace: BieberWorks.SDK.Wallet.Contracts.Permissions
public static class WalletPermissions
{
    public const string View             = "wallet:wallet:view";
    public const string TopUp            = "wallet:wallet:topup";
    public const string Admin            = "wallet:wallet:admin";
    public const string TransactionsView = "wallet:transactions:view";
}
```

## Bedeutung

| Konstante | Wert | Wirkung |
|---|---|---|
| `View` | `wallet:wallet:view` | Account-Shell-Eintrag „Mein Guthaben" sichtbar. Zugriff auf `/account/wallet` und `/account/wallet/transactions`. |
| `TopUp` | `wallet:wallet:topup` | „Guthaben aufladen"-Seite sichtbar und nutzbar (`/account/wallet/topup`). Fehlt → Seite gibt 403. |
| `Admin` | `wallet:wallet:admin` | Vollständiger Admin-Zugang: alle Wallets sehen, manuell aufladen/abbuchen, Währungen verwalten. Steuert alle `/admin/wallet/*`-Seiten. |
| `TransactionsView` | `wallet:transactions:view` | Transaktionshistorie einsehbar (eigene für User, alle für Admins mit zusätzlichem `Wallet.Admin`). |

## Zuweisung

Permissions werden Rollen zugewiesen via `/admin/users/roles/{roleId}`.
`WalletPermissionContributor` registriert alle 4 Permissions automatisch beim Start —
kein manuelles Eintragen im Admin-Panel nötig.

## REST-Endpunkte

| Endpunkt | Benötigte Permission |
|---|---|
| `GET /bw/wallet/me` | Auth + `wallet:wallet:view` |
| `GET /bw/wallet/me/transactions` | Auth + `wallet:transactions:view` |
| `GET /bw/wallet/admin/*` | `wallet:wallet:admin` |
| `POST /bw/wallet/admin/{userId}/topup` | `wallet:wallet:admin` |
