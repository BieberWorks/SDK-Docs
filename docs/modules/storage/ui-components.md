# UI Components

Package: `BieberWorks.SDK.Storage.UI.MudBlazor`

The UI package provides ready-made MudBlazor pages for admin and users. It requires `SDK-Admin` (for `IAdminSection`/`IAdminPage`) and `SDK-Account` (for `IAccountSection`/`IAccountPage`).

## Adding to host

### 1. Service registration

```csharp
builder.Services.AddStorageUi(opts =>
{
    // Optional: link to user detail page in admin owner column
    opts.UserLinkTemplate = "/admin/users/{0}";  // {0} = user GUID

    // Optional: permission required by current user for link to render
    opts.UserLinkPermission = "auth:users:manage";
});
```

Without the `configure` parameter, `UserLinkTemplate` and `UserLinkPermission` default to `null` — owner IDs are shown as plain text.

### 2. Razor assembly in Program.cs

```csharp
app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode()
    .AddAdditionalAssemblies(
        typeof(BieberWorks.SDK.Storage.UI.MudBlazor.Pages.Admin.AllFilesPage).Assembly
    );
```

### 3. Router in Routes.razor

```razor
<Router AppAssembly="typeof(App).Assembly"
        AdditionalAssemblies="new[]
        {
            typeof(BieberWorks.SDK.Storage.UI.MudBlazor.Pages.Admin.AllFilesPage).Assembly
        }">
    <Found Context="routeData">
        <RouteView RouteData="routeData" DefaultLayout="typeof(MainLayout)" />
    </Found>
</Router>
```

::: warning Both entries are mandatory
Missing the assembly entry in `MapRazorComponents` means pages won't be found. Missing the router entry causes Blazor to show "Not found" on direct navigation to the URL.
:::

---

## Admin pages

### All files — `/admin/files`

**Permission:** `storage:file:admin`

Central file management page for administrators. Shows all files from all users.

Features:
- Table view with name, size, content-type, visibility, owner, upload date
- Quicksearch (name / content-type, debounced 300 ms)
- Visibility filter for uploads
- File upload with visibility selection (configurable via `StorageSharingOptions`)
- Role field appears for `RoleRestricted` visibility (comma-separated role names)
- "Show internal" toggle — reveals `AppResource` files (avatars, logos)
- Download and delete per row (with confirmation dialog)
- Click row to navigate to `/admin/files/{fileId}`
- Owner column with optional link (via `StorageUiOptions.UserLinkTemplate`)
- Allowed content types loaded from `IStorageSettingsService`; `accept` attribute and hint text auto-set
- Max upload size: 50 MB

### File detail — `/admin/files/{fileId}`

**Permission:** `storage:file:admin`

Detail view of a single file with metadata, visibility change, and delete.

### Storage settings — `/admin/storage/settings`

**Permission:** `storage:settings:manage`

Manage module-wide settings.

Features:
- Display currently allowed content types as removable chips
- Manual add via text field (enter or button)
- Quick presets: `image/*`, `application/pdf`, `text/*`, Word, Excel, PowerPoint, ZIP, JSON
- Save persists the list to `storage.storage_settings` via `IStorageSettingsService`

::: info Empty list = all allowed
If the allowed types list is empty, all content types are accepted. This is the state after first migration.
:::

---

## Account pages (users)

### My files — `/account/files`

**Permission:** `storage:file:read`

File management for the logged-in user. Shows only that user's files.

Features:
- Table view with name, size, content-type, visibility, upload date
- Quicksearch
- File upload with visibility selection
- Role field for `RoleRestricted`
- Download and delete per row
- Click row to navigate to `/account/files/{fileId}`
- Max upload size: 50 MB

### My file detail — `/account/files/{fileId}`

**Permission:** `storage:file:read`

Detail view of own file with metadata, rename, visibility change, and delete.

### Shared files — `/account/shared-files`

Files shared with the current user (public or role-restricted with matching role).

### Shared file detail — `/account/shared-files/{fileId}`

Detail view of a shared file (read-only).

---

## Shared components

### BwFileUploadButton

Styled upload button (MudBlazor) that wraps the native `<input type="file">` — no need for `IJSRuntime` in the consumer.

#### Setup

Add the script tag once in `App.razor` or `index.html`:

```html
<script src="_content/BieberWorks.SDK.Storage.UI.MudBlazor/bw-file-upload.js"></script>
```

#### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `OnFileSelected` | `EventCallback<IBrowserFile>` | — | Fires after file selection (before upload) |
| `OnUploaded` | `EventCallback<FileReference>` | — | Fires after successful upload (only if `UploadImmediately=true`) |
| `Accept` | `string` | `"*/*"` | MIME filter for the file picker, e.g. `"image/*"` |
| `MaxFileSizeMb` | `int` | `10` | Maximum file size in MB (client-side check) |
| `Disabled` | `bool` | `false` | Disables the button |
| `Label` | `string` | `"Datei auswählen"` | Button text |
| `Variant` | `Variant` | `Variant.Filled` | MudBlazor button variant |
| `Color` | `Color` | `Color.Primary` | MudBlazor button color |
| `Size` | `Size` | `Size.Medium` | MudBlazor button size |
| `UploadImmediately` | `bool` | `false` | If `true`: component calls `IStorageService` directly |
| `Visibility` | `StorageFileVisibility` | `AppResource` | Visibility of the uploaded file |
| `StorageKey` | `string?` | `null` | Optional filename override for the storage key |
| `OwnerUserId` | `string?` | `null` | Optional user ID for file assignment (required if `UploadImmediately=true`) |

#### Behavior

- Automatically shows a loading spinner during upload (`UploadImmediately=true`)
- File size exceeded → snackbar error message, no crash
- Upload error → snackbar error message

#### Example 1: File selection only (consumer handles upload)

```razor
<BwFileUploadButton
    Accept="image/*"
    MaxFileSizeMb="5"
    OnFileSelected="@HandleFile" />

@code {
    private async Task HandleFile(IBrowserFile file)
    {
        await StorageService.UploadAsync(file.OpenReadStream(), file.Name, file.ContentType,
            StorageFileVisibility.UserFile, ownerUserId: _userId);
    }
}
```

#### Example 2: Auto-upload with OwnerUserId

```razor
<BwFileUploadButton
    Label="Profilbild hochladen"
    Accept="image/*"
    MaxFileSizeMb="2"
    UploadImmediately="true"
    Visibility="StorageFileVisibility.UserFile"
    OwnerUserId="@_currentUserId"
    OnUploaded="@(ref => _avatarUrl = ref.Url)" />
```

#### Example 3: Event image (no owner)

```razor
<BwFileUploadButton
    Label="Bild hochladen"
    Accept="image/*"
    MaxFileSizeMb="10"
    UploadImmediately="true"
    Visibility="StorageFileVisibility.AppResource"
    OnUploaded="@(ref => _imageUrl = ref.Url)" />
```

### FileDetailView

Reusable detail view for a single file. Used by admin and account detail pages.

---

## Permissions overview

| Permission | Key | Purpose |
|---|---|---|
| `StoragePermissions.FileRead` | `storage:file:read` | View / download own files |
| `StoragePermissions.FileWrite` | `storage:file:write` | Upload own files |
| `StoragePermissions.FileDelete` | `storage:file:delete` | Delete own files |
| `StoragePermissions.FileAdmin` | `storage:file:admin` | Manage all files (admin) |
| `StoragePermissions.FileSettingsManage` | `storage:settings:manage` | Manage module settings |

Permissions are automatically registered in the Auth permissions catalog via `StoragePermissionContributor` (implements `IPermissionContributor`). Roles can be assigned these permissions in the SDK-Auth admin UI.

::: tip Policy prefix
All `[Authorize(Policy = "...")]` attributes in Razor pages use the prefix `perm:` (e.g. `perm:storage:file:admin`). This follows the SDK-Auth module convention.
:::
