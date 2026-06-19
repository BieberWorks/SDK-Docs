# Währungen — ISO 4217 Catalog & WalletCurrencyService

## Iso4217Catalog

```csharp
// Namespace: BieberWorks.SDK.Wallet.Contracts.Currencies
public static class Iso4217Catalog
{
    public static bool TryGet(string code, out CurrencyDefinition? definition);
    public static IReadOnlyCollection<CurrencyDefinition> GetAll();
    public static bool Contains(string code);
}
```

- ~170 ISO-4217-Codes als statisches Dictionary (kein externer Datei-Lookup, kein NuGet).
- Code-Lookup ist case-insensitive (`"eur"` → findet `"EUR"`).
- Enthaltene Codes: EUR, USD, GBP, CHF, JPY, CAD, AUD, SEK, NOK, DKK, PLN, CZK, HUF, RON, BGN, CNY, INR, BRL, MXN, SGD, HKD, NZD, ZAR, TRY, KRW, IDR, MYR, PHP, THB, AED, SAR, ILS, EGP, NGN, KES, GHS, MAD, TND, XOF, XAF, und ~130 weitere.

## IWalletCurrencyService

```csharp
// Namespace: BieberWorks.SDK.Wallet.Contracts.Interfaces
public interface IWalletCurrencyService
{
    Task<IReadOnlyList<ActiveCurrencyDto>> GetActiveCurrenciesAsync(CancellationToken ct = default);
    Task<Result> EnableCurrencyAsync(string currencyCode, bool isDefault = false, CancellationToken ct = default);
    Task<Result> DisableCurrencyAsync(string currencyCode, CancellationToken ct = default);
    Task<Result> SetDefaultCurrencyAsync(string currencyCode, CancellationToken ct = default);
}
```

### Regeln

- Nur Codes aus `Iso4217Catalog` können freigeschaltet werden.
- Die Default-Währung kann nicht deaktiviert werden (erst eine andere als Default setzen).
- Genau eine Währung kann `IsDefault = true` haben (Application-Level-Constraint).
- Wallet-Einträge speichern die Währung denormalisiert (`CurrencyCode`-Spalte).

## Admin-UI

Route: `/admin/wallet/currencies`

- ISO-4217-Katalog durchsuchen (Code-Suche).
- Währung freischalten (→ `EnableCurrencyAsync`).
- Default-Währung setzen (→ `SetDefaultCurrencyAsync`).
- Währung deaktivieren (→ `DisableCurrencyAsync`, nicht möglich für Default).
