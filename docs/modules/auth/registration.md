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

## Error Codes

| Code | Meaning |
|------|---------|
| `Identity.RegistrationDisabled` | Registration is currently off (either layer). |
