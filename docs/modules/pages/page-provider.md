# IPageProvider — Seeding Interface

`IPageProvider` allows consumer modules to declare static pages that are
automatically created in the database on application startup if the slug does
not yet exist.

SDK-Pages itself contains no domain-specific content. Content semantics belong
in the consuming module.

## Interface

```csharp
public interface IPageProvider
{
    IEnumerable<ManagedPage> GetPages();
}
```

## ManagedPage

```csharp
public record ManagedPage(
    string Slug,
    IReadOnlyList<ManagedPageTranslation> Translations,
    bool   AllowAdminEdit = true,
    string? Category      = null);

public record ManagedPageTranslation(
    string  Culture,         // BCP-47 code, e.g. "en" or "de"
    string  Title,
    string? Body,
    string? MetaDescription = null);
```

### Backward-compatible single-language constructor

For modules that only need one language, the old signature still compiles without
any changes:

```csharp
// Creates one translation with Culture = "en" (default)
new ManagedPage("impressum", "Imprint", "# Imprint\n\nContent.", AllowAdminEdit: false)

// Explicit culture
new ManagedPage(slug: "impressum", defaultTitle: "Imprint", defaultBody: "# ...",
                allowAdminEdit: false, defaultCulture: "de")
```

## Example — multi-language provider

```csharp
public sealed class LegalPageProvider : IPageProvider
{
    public IEnumerable<ManagedPage> GetPages() =>
    [
        new ManagedPage(
            Slug: "impressum",
            Translations:
            [
                new("en", "Imprint",  "# Imprint\n\nContent."),
                new("de", "Impressum","# Impressum\n\nInhalt."),
            ],
            AllowAdminEdit: false,
            Category: "legal"),

        new ManagedPage(
            Slug: "privacy",
            Translations:
            [
                new("en", "Privacy Policy", "# Privacy\n\nContent."),
                new("de", "Datenschutz",    "# Datenschutz\n\nInhalt."),
            ]),
    ];
}

// Registration:
services.AddSingleton<IPageProvider, LegalPageProvider>();
```

## Seeding Behavior

- Seeding runs during `IModuleInitializer.InitializeAsync` (after EF migrations).
- A page is only created if no page with the same `Slug` exists — idempotent.
- Seeding does **not** publish domain events and does not appear in the audit log.
- Seeded pages are created with `Status = Published`.
- All translations supplied in `ManagedPage.Translations` are inserted on first creation.
  If the slug already exists, the seeder skips the page **entirely** (no translation updates).

## AllowAdminEdit Semantics

When a page is seeded with `AllowAdminEdit: false`:

- The edit form shows an info banner (`Pages.ManagedByProvider` localization key).
- All input fields are rendered with `Disabled="true"`.
- The Save button is hidden.
- `IPageAdminService.UpdateAsync` and `DeleteAsync` return `Result.Failure` at the service layer.

**Note:** If a page was previously seeded with `AllowAdminEdit: true` and later changed
to `false` in the provider, the existing database row retains the old value. The seeder
skips existing slugs. A manual DB update or a data migration is required to change the
flag on already-seeded rows.

## Multiple Providers

Multiple `IPageProvider` implementations can be registered. Slug uniqueness across
providers is the consumer's responsibility — duplicates cause a duplicate-key DB error
on first startup.
