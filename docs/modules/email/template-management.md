# Template Management — SDK-Email

The template management system allows administrators to override transactional email templates and manage HTML layouts through the Admin UI, without touching source code. Templates are authored in [Scriban](https://github.com/scriban/scriban) syntax, stored in the database, and cached in memory.

## Architecture overview

```
IEmailTemplateDescriptor (registered by each module)
        │
        ▼
CachedEmailTemplateStore (Singleton, IEmailRenderingPipeline)
  ├─ DB override (EmailTemplateOverride entity, locale-aware)
  ├─ FileSystem override (Email:TemplatePath)
  └─ Code default (IEmailTemplateDescriptor.DefaultHtmlContent)
        │
        ▼
   Layout wrapping (EmailLayout entity, {{ content }} slot)
        │
        ▼
   Scriban rendering (variables + global branding)
        │
        ▼
   RenderedEmail { HtmlBody, PlainTextBody }
```

The plain-text body is auto-generated from HTML when `IEmailTemplateDescriptor.DefaultPlainTextContent` is `null`.

## IEmailTemplateDescriptor — Register a template

Any module can expose transactional emails by implementing `IEmailTemplateDescriptor` and registering it as a singleton.

```csharp
using BieberWorks.SDK.Email.Contracts;

public sealed class PasswordResetDescriptor : IEmailTemplateDescriptor
{
    public string Key         => "auth:password-reset";
    public string DisplayName => "Password Reset";
    public string? Group      => "Authentication";

    public IReadOnlyList<EmailTemplateVariable> Variables =>
    [
        new("ResetLink", EmailTemplateVariableType.Url,  "One-time password reset URL.", "https://example.com/reset?token=abc"),
        new("UserEmail", EmailTemplateVariableType.Text, "Recipient email address.",     "user@example.com"),
    ];

    public string DefaultHtmlContent => """
        <!DOCTYPE html>
        <html>
        <body>
          <p>Click the link below to reset your password:</p>
          <a href="{{ ResetLink }}">Reset password</a>
          <p><small>Sent to {{ UserEmail }}.</small></p>
        </body>
        </html>
        """;

    public string? DefaultPlainTextContent => null; // auto-stripped from HTML
}

// In your IModule or Program.cs:
services.TryAddEnumerable(
    ServiceDescriptor.Singleton<IEmailTemplateDescriptor, PasswordResetDescriptor>());
```

### Key naming convention

Use reverse-domain style: `"module:event"`, e.g. `"auth:password-reset"`, `"wallet:low-balance"`, `"contact:confirmation"`. The key is stored in the database as the override key and passed to `IEmailTemplateRenderer` / `IEmailRenderingPipeline`.

### Template syntax

Templates use [Scriban](https://github.com/scriban/scriban) syntax. Variables are referenced as `{{ VariableName }}` (case-insensitive). Unknown variables render as an empty string (`StrictVariables = false`). The seven global branding variables (`LogoUrl`, `LogoUrlDark`, `BrandColor`, `BrandColorDark`, `AppName`, `AppBaseUrl`, `Year`) are injected automatically — see [Branding Integration](branding-integration.md).

## IEmailRenderingPipeline — Render a template

`IEmailRenderingPipeline` is the core rendering contract, registered as a singleton. It resolves the DB override (or falls back to the code default), applies the layout, and runs Scriban.

```csharp
using BieberWorks.SDK.Email.Contracts;

public class PasswordResetService(
    IEmailSender emailSender,
    IEmailRenderingPipeline pipeline)
{
    public async Task SendAsync(string to, string resetLink, CancellationToken ct = default)
    {
        var rendered = await pipeline.RenderAsync(
            key: "auth:password-reset",
            variables: new Dictionary<string, string>
            {
                ["ResetLink"] = resetLink,
                ["UserEmail"] = to,
            },
            locale: null, // null = default locale
            ct: ct);

        var message = new EmailMessage(to, "Reset your password", rendered.HtmlBody);
        await emailSender.SendAsync(message, ct);
    }
}
```

`RenderAsync` returns a `RenderedEmail` record:

| Property | Type | Description |
|---|---|---|
| `HtmlBody` | `string` | Fully rendered HTML (layout applied, Scriban evaluated, branding injected) |
| `PlainTextBody` | `string` | Plain-text version (stripped from HTML when no explicit plain-text is provided) |

## IEmailTemplateAdminService — Admin operations

`IEmailTemplateAdminService` is scoped and used exclusively by the Admin UI. It exposes:

| Method | Description |
|---|---|
| `GetAllTemplatesAsync` | Returns all descriptors merged with any existing DB overrides |
| `GetTemplateAsync(key, locale)` | Returns a single `EmailTemplateDto`; falls back to default locale, then to code default |
| `SaveOverrideAsync(command)` | Creates or replaces the DB override for a key/locale pair |
| `ResetToDefaultAsync(key, locale)` | Removes the DB override, restoring the code default |
| `RenderPreviewAsync(key, overrideHtml, layoutId)` | Renders using example values; never persists |
| `GetAllLayoutsAsync` | Returns all stored layouts |
| `GetLayoutAsync(id)` | Returns a single layout |
| `CreateLayoutAsync(command)` | Creates a new layout, returns the generated ID |
| `UpdateLayoutAsync(command)` | Updates an existing layout |
| `DeleteLayoutAsync(id)` | Deletes a layout; override rows that referenced it have their layout set to `NULL` |
| `GetGlobalBrandingVariables()` | Returns `GlobalEmailVariables.Branding` for display in the editor panel |

## Layouts

Layouts wrap template HTML in a shared outer shell (header, footer, logo). A layout must contain the `{{ content }}` slot, which is replaced by the rendered inner template.

**Example layout:**

```html
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; background: #f5f5f5;">
  <table width="600" align="center" style="background:#fff; padding:32px;">
    <tr><td>
      <img src="{{ LogoUrl }}" alt="{{ AppName }}" style="height:40px;" />
    </td></tr>
    <tr><td>
      {{ content }}
    </td></tr>
    <tr><td style="color:#888; font-size:12px;">
      &copy; {{ Year }} {{ AppName }}
    </td></tr>
  </table>
</body>
</html>
```

The Admin UI validates that the layout body contains `{{ content }}` before saving. Layouts that omit this slot cannot wrap any template correctly.

## Admin UI pages

The Admin UI is provided by `BieberWorks.SDK.Email.UI.MudBlazor` and registered automatically via `EmailUiModule`.

| Route | Description | Required permission |
|---|---|---|
| `/admin/email/templates` | Templates list, grouped by `Group`, with "customized" badge on overridden templates | `email:templates:view` |
| `/admin/email/templates/{key}` | Template editor: locale selector, layout dropdown, variable token validation, live preview | `email:templates:edit` |
| `/admin/email/layouts` | Layouts list | `email:templates:view` |
| `/admin/email/layouts/{id}` | Layout editor with `{{ content }}` slot validation and live preview | `email:layouts:manage` |

The live preview renders via a `POST /admin/email/preview` endpoint (also registered by `EmailUiModule`). The endpoint requires the `email:templates:edit` permission.

## Locale overrides

Template overrides are keyed on `(key, locale)`. Locale is stored as a string (e.g. `"en"`, `"de"`, `"en-US"`). When `locale` is `null` or empty, the default-locale override is used.

The Admin UI exposes a locale selector in the template editor. Saving a template for a specific locale creates or replaces the override for that locale only.

## Caching

| Cache layer | TTL | What is cached |
|---|---|---|
| Template + layout | 30 minutes (absolute) | Rendered template HTML and layout HTML from DB |
| Branding snapshot | 5 minutes (absolute) | `EmailBranding` from `IBrandingService` |

Cache entries are invalidated when:
- A template override is saved or reset (`EmailTemplateOverrideSavedEvent`, `EmailTemplateOverrideResetEvent`)
- A layout is saved (`EmailLayoutSavedEvent`)
- Branding assets change (`BrandingChangedEvent` → `BrandingChangedHandler`)

## IEmailTemplateEditorFactory — Swappable editor

The editor component inside the template editor page is provided by `IEmailTemplateEditorFactory`. The default implementation (`TextareaEmailTemplateEditorFactory`) renders a MudBlazor-styled monospace `<textarea>` with no JavaScript dependencies.

To replace it with a richer editor (e.g. Monaco):

```csharp
// Register before AddBieberWorksModules so TryAddSingleton in EmailUiModule is a no-op.
builder.Services.AddSingleton<IEmailTemplateEditorFactory, MonacoEmailTemplateEditorFactory>();
```
