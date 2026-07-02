# Currencies — ISO 4217 Catalog & WalletCurrencyService

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

- ~170 ISO 4217 codes as a static dictionary (no external file lookup, no additional NuGet).
- Code lookup is case-insensitive (`"eur"` resolves to `"EUR"`).
- Included codes: EUR, USD, GBP, CHF, JPY, CAD, AUD, SEK, NOK, DKK, PLN, CZK, HUF, RON, BGN, CNY, INR, BRL, MXN, SGD, HKD, NZD, ZAR, TRY, KRW, IDR, MYR, PHP, THB, AED, SAR, ILS, EGP, NGN, KES, GHS, MAD, TND, XOF, XAF, and ~130 more.

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

### Rules

- Only codes present in `Iso4217Catalog` can be enabled.
- The default currency cannot be disabled — set another currency as default first.
- Exactly one currency can have `IsDefault = true` (application-level constraint).
- Wallet entries store the currency denormalised (`CurrencyCode` column).

## Admin UI

Route: `/admin/wallet/currencies`

- Search the ISO 4217 catalog (code search).
- Enable a currency (`EnableCurrencyAsync`).
- Set the default currency (`SetDefaultCurrencyAsync`).
- Disable a currency (`DisableCurrencyAsync` — not available for the current default).
