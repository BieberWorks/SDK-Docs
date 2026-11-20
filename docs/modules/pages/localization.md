# Localization — SDK-Pages

SDK-Pages ships with built-in German (default/fallback) and English translations for all UI strings. The layered localizer pattern from SDK-Localization applies: DB overrides take precedence over the bundled `.resx` files.

## Resource Files

Located in `src/BieberWorks.SDK.Pages.UI.Blazor.MudBlazor/Resources/`:

| File | Language |
|---|---|
| `Pages.de.resx` | German (default/fallback) |
| `Pages.en.resx` | English |

Injected in Razor components as `IStringLocalizer<PagesResources>`:

```razor
@inject IStringLocalizer<PagesResources> L

<MudText>@L["Pages.Title"]</MudText>
```

## Localization Key Table

| Key | de | en |
|---|---|---|
| `Pages.Title` | Seiten | Pages |
| `Pages.Slug` | Slug | Slug |
| `Pages.TitleLabel` | Titel | Title |
| `Pages.Body` | Inhalt | Content |
| `Pages.MetaTitle` | Meta-Titel | Meta Title |
| `Pages.MetaDescription` | Meta-Beschreibung | Meta Description |
| `Pages.Status.Draft` | Entwurf | Draft |
| `Pages.Status.Published` | Veröffentlicht | Published |
| `Pages.Admin.NewPage` | Neue Seite | New Page |
| `Pages.Admin.Save` | Speichern | Save |
| `Pages.Admin.SaveSuccess` | Seite wurde gespeichert. | Page saved successfully. |
| `Pages.Admin.Delete` | Löschen | Delete |
| `Pages.Admin.DeleteConfirm` | Seite wirklich löschen? | Really delete this page? |
| `Pages.Admin.Publish` | Veröffentlichen | Publish |
| `Pages.Admin.Unpublish` | Zurückziehen | Unpublish |
| `Pages.Admin.Column.Title` | Titel | Title |
| `Pages.Admin.Column.Slug` | Slug | Slug |
| `Pages.Admin.Column.Status` | Status | Status |
| `Pages.Admin.Column.UpdatedAt` | Zuletzt geändert | Last modified |
| `Pages.Admin.Column.Actions` | Aktionen | Actions |
| `Pages.Admin.Edit` | Bearbeiten | Edit |
| `Pages.ManagedByProvider` | Diese Seite wird durch ein Modul verwaltet und kann hier nicht bearbeitet werden. | This page is managed by a module and cannot be edited here. |
| `Pages.Error.SlugTaken` | Dieser Slug ist bereits vergeben. | This slug is already taken. |
| `Pages.Error.NotFound` | Seite nicht gefunden. | Page not found. |
| `Pages.Error.PermissionDenied` | Keine Berechtigung für diese Aktion. | Insufficient permissions for this action. |
| `Pages.Public.NotFound` | Diese Seite existiert nicht oder wurde noch nicht veröffentlicht. | This page does not exist or has not been published yet. |
| `Pages.SlugHint` | Leer lassen für automatische Generierung aus dem Titel. | Leave empty to auto-generate from title. |
| `Pages.Route.Conflict` | Diese Route ist bereits belegt: {0} | This route is already taken: {0} |
| `Pages.Route.Preview` | Öffentliche URL: {0} | Public URL: {0} |
| `Pages.RequiredRole` | Sichtbarkeit | Visibility |
| `Pages.RequiredRole.Public` | Öffentlich (alle) | Public (everyone) |
| `Pages.RequiredRole.Restricted` | Nur für: {0} | Restricted to: {0} |
| `Pages.AccessDenied` | Du hast keinen Zugriff auf diese Seite. | You do not have access to this page. |
| `Pages.Category` | Kategorie | Category |
| `Pages.Category.Hint` | Optional. Wird für kategoriespezifische Route-Präfixe verwendet (z.B. "blog" → /blog/{slug}). | Optional. Used to select a category-specific route prefix (e.g. "blog" → /blog/{slug}). |
| `Pages.Translations` | Übersetzungen | Translations |
| `Pages.Translation.FallbackNote` | Inhalt in Fallback-Sprache: {0} | Content shown in fallback culture: {0} |

34 keys total.

## Overriding via SDK-Localization Admin

When SDK-Localization is installed, all `Pages.*` keys appear in the admin UI under `/admin/localization`. DB overrides take effect immediately (cached, invalidated on change) without redeployment.

Example: to change the German label for the publish button at runtime:

1. Open `/admin/localization`
2. Search for `Pages.Admin.Publish`
3. Set value `de` → `Freischalten`
4. Save — the change is active on next page load.

## Culture Switching

The host must configure `RequestLocalizationOptions` with supported cultures. SDK-Localization provides the `/bw/set-culture` endpoint for switching languages. Example:

```
/bw/set-culture?culture=en&redirectUri=/admin/pages
```
