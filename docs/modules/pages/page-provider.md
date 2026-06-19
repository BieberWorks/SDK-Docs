# IPageProvider — Seeding Interface

`IPageProvider` allows consumer modules (e.g. a future SDK-Legal) to declare static pages that are automatically created in the database on application startup if the slug does not yet exist.

SDK-Pages itself contains no domain-specific content (no Legal, AGB, or GDPR concepts). That separation is intentional — content semantics belong in the consuming module.

## Interface

```csharp
// BieberWorks.SDK.Pages.Contracts.IPageProvider
public interface IPageProvider
{
    IEnumerable<ManagedPage> GetPages();
}

public record ManagedPage(
    string Slug,
    string DefaultTitle,
    string DefaultBody,
    bool   AllowAdminEdit = true);
```

### Parameters

| Parameter | Type | Description |
|---|---|---|
| `Slug` | `string` | Unique URL slug (e.g. `"impressum"`). Must be globally unique across all providers. |
| `DefaultTitle` | `string` | Title set when the page is first created. |
| `DefaultBody` | `string` | Markdown content set when the page is first created. |
| `AllowAdminEdit` | `bool` | `true` (default) = admins can edit the page via the admin UI. `false` = page is read-only in the admin UI (content managed via code deploy only). |

## Example Implementation

```csharp
// In a consumer module (e.g. SDK-Legal):
public sealed class LegalPageProvider : IPageProvider
{
    public IEnumerable<ManagedPage> GetPages() =>
    [
        new("agb",         "Allgemeine Geschäftsbedingungen", "# AGB\n\nContent follows."),
        new("datenschutz", "Datenschutzerklärung",            "# Privacy\n\nContent follows."),
        new("impressum",   "Impressum",                       "# Impressum\n\nContent follows.",
            AllowAdminEdit: false),
    ];
}

// Registration in the consumer module's IModule.RegisterServices:
services.AddSingleton<IPageProvider, LegalPageProvider>();
```

## Seeding Behavior

- Pages are seeded during `IModuleInitializer.InitializeAsync` (after EF migrations).
- A page is only created if no page with the same `Slug` already exists in the database — idempotent, safe to run on every startup.
- Seeding does **not** publish domain events. Seeded pages do not appear in the audit log (they are not admin actions).
- Seeded pages are created with `Status = Published` by default.
- The `AllowAdminEdit` flag is persisted in the `PageEntity` so the admin UI can enforce it at runtime without querying the providers again.

## AllowAdminEdit Semantics

When a page is seeded with `AllowAdminEdit: false`:

- The edit form in the admin UI shows an info banner (`Pages.ManagedByProvider` localization key).
- All input fields are rendered with `Disabled="true"`.
- The Save button is hidden.
- `IPageAdminService.UpdateAsync` and `DeleteAsync` return `Result.Failure` for these pages (service-layer enforcement in addition to UI).

**Important:** If a page was previously seeded with `AllowAdminEdit: true` and the provider is later changed to `AllowAdminEdit: false`, the existing `PageEntity.AllowAdminEdit` in the database retains the old value. The seeder skips existing slugs and does not update `AllowAdminEdit`. A manual DB update or a migration is required to change the flag on existing rows.

## DefaultBody and Re-seeding

The `DefaultBody` is only applied on first creation. If an admin edits the body and the application is restarted, the seeder detects the existing slug and skips the page entirely — the admin's content is preserved.

There is no mechanism to "reset to default" from the seeder. Content versioning and reset flows are planned for a future SDK-Legal module.

## Multiple Providers

Multiple `IPageProvider` implementations can be registered. The seeder collects all pages from all providers via `IEnumerable<IPageProvider>`. Slug uniqueness across providers is the consumer's responsibility — duplicate slugs across providers produce a duplicate-key database error on first startup.
