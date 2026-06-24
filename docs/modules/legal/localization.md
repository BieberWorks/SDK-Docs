# Localization

## UI strings

The `Legal.UI.MudBlazor` package ships three resource files:

| File | Coverage |
|---|---|
| `LegalUiMudBlazorModule.resx` | Neutral fallback (English) — ensures strings never fall through to raw keys |
| `LegalUiMudBlazorModule.en.resx` | English |
| `LegalUiMudBlazorModule.de.resx` | German |

Inject `IStringLocalizer<LegalUiMudBlazorModule>` in Razor components.

## Document content

Document content is stored per `(DocumentKey, Culture)` in the database.
`LegalOptions.Cultures` determines which cultures are seeded on first run.
The admin UI allows editing each combination independently.
