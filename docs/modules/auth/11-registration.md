# Registration Feature

User self-registration can be controlled via two independent layers. Both must be enabled for
registration to be open. This design allows a hard server-side lock (no admin can override it)
as well as a runtime admin toggle without a deployment.

## Two-Layer Gate

| Layer | Where | Default | Can admin override? |
|-------|-------|---------|---------------------|
| Host configuration | `appsettings.json` / env vars | `true` | No — requires redeployment |
| Admin toggle | SDK-Settings DB | `true` | Yes — instant effect |

**Effective state = Host config AND Admin toggle.**

## Host Configuration

Section: `Auth:Registration`

```json
{
  "Auth": {
    "Registration": {
      "Enabled": false
    }
  }
}
```

Class: `BieberWorks.SDK.Auth.Contracts.AuthRegistrationOptions`

When `Enabled` is `false`:
- The REST endpoint `/auth/register` returns HTTP 403 before dispatching (no DB roundtrip).
- The handler also blocks (double-check pattern).
- The Blazor Register page redirects to `/auth/login` on initialization.

## Admin Toggle (SDK-Settings)

Setting key: `auth:registration:enabled`  
Type: Boolean  
Default: `true`

Requires the **SDK-Settings** module to be registered. Without it, the admin toggle is treated
as enabled and the UI shows a warning.

Registered automatically in `AuthModule.InitializeAsync` via `ISettingsAdminService.RegisterDefinitionAsync`.

## Permission

Key: `auth:registration:manage`  
Category: Auth / Registration

Assign this permission to roles that should be allowed to manage the registration toggle.
Without it the admin page at `/admin/auth/registration` returns 403.

## Admin Route

`/admin/auth/registration`

The page is registered as `IAdminPage` and appears in the Auth admin section nav under
"Registration". It shows:

- **Host configuration status** (read-only chip — requires redeployment to change).
- **Admin toggle** (MudSwitch, disabled when SDK-Settings is absent).
- **Effective state** (logical AND of the two layers above).

If SDK-Settings is not available, a warning banner is shown and the toggle is disabled.

## AppBar `ShowLogin` / `ShowRegister` Options

The app-bar widget respects two **UI-only** flags on `AuthUiOptions.AppBar`:

- `ShowRegister` (default `true`) — hides the Register button from the app bar.
- `ShowLogin` (default `true`) — hides the Login button from the app bar.

Both are display-only and do **not** protect the `/auth/register` or `/auth/login` routes; the
routes stay reachable directly. Use the gate layers above for actual registration enforcement.

Hiding the Login button is useful for single-admin or invite-only apps (e.g. a personal portfolio
with a backend): set `ShowLogin = false` so visitors see no sign-in entry point, while you still
log in by navigating to `/auth/login` directly. Combine with a disabled registration gate to leave
the instance effectively single-user.

## Recipe: Single-User / Portfolio Setup

To run an instance that only you can access — no public sign-up, no visible auth entry points,
but you can still log in via the direct route:

1. **Hard-disable registration** (host config — no admin can re-open it):

   ```json
   {
     "Auth": {
       "Registration": {
         "Enabled": false
       }
     }
   }
   ```

2. **Hide both auth buttons** from the app bar so visitors see a clean UI:

   ```csharp
   builder.Services.AddAuthUi(o =>
   {
       o.AppBar.ShowLogin = false;
       o.AppBar.ShowRegister = false;
   });
   ```

3. **Log in yourself** by navigating to `/auth/login` directly (bookmark it). The route stays
   reachable even with the buttons hidden.

Result: `/auth/register` redirects to login and the endpoint returns 403; visitors see no auth
buttons; you retain full access via the direct login route.

## Request fields

`POST /api/auth/register` accepts this JSON body (property names are case-insensitive):

| Field | Required | Rules |
|-------|----------|-------|
| `email` | yes | Non-empty. Missing or blank: `400`, `Identity.EmailRequired`. |
| `password` | yes | Non-empty and accepted by the configured Identity password rules. Missing or empty: `400`, `Identity.Password.Required`. |
| `firstName` | no | Trimmed; maximum 100 characters. Missing or `null` is stored as an empty string. Longer: `422`, `Identity.Register.FirstNameTooLong`. |
| `lastName` | no | Same rules as `firstName`; error `Identity.Register.LastNameTooLong`. |

Input is validated before any database access. The UI (`RegisterViewModel`) sends empty strings for both names, which stays valid.

## Error Codes

| Code | Meaning |
|------|---------|
| `Identity.RegistrationDisabled` | Registration is currently off (either layer). |
| `Identity.EmailRequired` | The email address is missing or blank (400). |
| `Identity.Password.Required` | The password is missing or empty (400). |
| `Identity.Register.FirstNameTooLong` | First name longer than 100 characters (422). |
| `Identity.Register.LastNameTooLong` | Last name longer than 100 characters (422). |
| `Identity.EmailAlreadyRegistered` | A confirmed account with this address exists (409). |
| `Identity.Register.Failure` | The account was created but no token could be issued (400). |

Message texts (English / German):

| Code | English | German |
|------|---------|--------|
| `Identity.RegistrationDisabled` | Registration is currently disabled. | Die Registrierung ist derzeit deaktiviert. |
| `Identity.EmailRequired` | An email address is required. | Eine E-Mail-Adresse ist erforderlich. |
| `Identity.Password.Required` | A password is required. | Ein Passwort ist erforderlich. |
| `Identity.Register.FirstNameTooLong` | The first name must not be longer than 100 characters. | Der Vorname darf höchstens 100 Zeichen lang sein. |
| `Identity.Register.LastNameTooLong` | The last name must not be longer than 100 characters. | Der Nachname darf höchstens 100 Zeichen lang sein. |
| `Identity.EmailAlreadyRegistered` | This email address is already registered. | Diese E-Mail-Adresse ist bereits registriert. |

The `message` of every error response (`ErrorResponseDto`) and every `AuthResult.Errors` entry is localized
(English and German, current UI culture) through `IErrorLocalizer`. The texts come from `AuthErrorResources`
(`Error_<code with '.' replaced by '_'>`, e.g. `Error_Identity_Login_EmailNotConfirmed`), which Auth registers via
`AddErrorResources<AuthErrorResources>()`. Operators can override single texts with SDK-Localization (module `Auth`).
The machine-readable `code` is unchanged, so clients should branch on `code`, never on `message`.
