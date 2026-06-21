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

## Uploading from feature modules

### The rule: do not reference `Storage.UI.MudBlazor` from a feature module

Feature modules (e.g. `Experience`, `Projects`, or any other domain module) **must not** take a `PackageReference` on `BieberWorks.SDK.Storage.UI.MudBlazor`. The governing rule is SDK UI-Dependency **Rule 2** (the layering rule), not Rule 3:

> Only `SDK-UI` is the shared UI layer. Feature modules may take a shared-UI dependency **only** on `BieberWorks.SDK.UI.Contracts` and/or `BieberWorks.SDK.UI.MudBlazor`. A feature module must not reference the `.UI.MudBlazor` package of another feature module.

This is a **layering** rule, not a transitive-dependency-hygiene rule. It holds even though `Storage.UI.MudBlazor`'s nuspec is clean (it depends only on `*.Contracts` packages + `MudBlazor` + `Markdig`, and pulls in **no** implementation package). The point is not "it drags foreign implementation in" — it does not. The point is that `Storage.UI.MudBlazor` is **not** the shared UI layer (`SDK-UI` is), so referencing it from `Projects`/`Experience` couples one feature module to another feature module's UI. That coupling also pins those modules to Storage's MudBlazor version and ties their static web assets together across module boundaries.

(Rule 3 — "no `*.UI.MudBlazor → *.UI.MudBlazor`" — is a separate, package-graph hygiene rule. A feature module is not itself a `.UI.MudBlazor` package, so Rule 3 alone would not catch this case. Rule 2 is what makes the reference off-pattern.)

`BwFileUploadButton` is a MudBlazor UI component that lives inside `Storage.UI.MudBlazor`. It is intended exclusively for the host and for Storage's own built-in admin/account pages.

`FileReference` and `StorageFileVisibility` are already in `BieberWorks.SDK.Storage.Contracts` — that package is safe to reference from any module. The restriction covers the _component_, not the types.

### Correct approach: two patterns

#### Pattern A — Feature module builds its own upload UI (recommended)

The feature module references only `BieberWorks.SDK.Storage.Contracts`, injects `IStorageService`, and uses MudBlazor primitives it already has access to (`MudFileUpload` or plain `InputFile`). No reference to `Storage.UI.MudBlazor` is required.

`.csproj` — the only storage reference needed:

```xml
<PackageReference Include="BieberWorks.SDK.Storage.Contracts" Version="0.*-*" />
```

Razor page — using `MudFileUpload` (preferred for feature modules that already use MudBlazor):

```razor
@* ProjectsAdminPage.razor — feature module Razor page, no Storage.UI.MudBlazor reference *@
@inject IStorageService StorageService
@inject ISnackbar Snackbar

<MudFileUpload T="IBrowserFile" FilesChanged="HandleUploadAsync" Accept="image/*">
    <ActivatorContent>
        <MudButton Variant="Variant.Outlined" StartIcon="@Icons.Material.Filled.UploadFile">
            Upload image
        </MudButton>
    </ActivatorContent>
</MudFileUpload>

@if (_coverImageUrl is not null)
{
    <MudImage Src="@_coverImageUrl" Alt="Cover image" />
}

@code {
    private string? _coverImageUrl;
    private Guid? _currentUserId; // resolved from auth state in OnInitializedAsync

    private const long MaxBytes = 10L * 1024 * 1024; // 10 MB

    private async Task HandleUploadAsync(IBrowserFile file)
    {
        if (file.Size > MaxBytes)
        {
            Snackbar.Add("File exceeds 10 MB limit.", Severity.Warning);
            return;
        }

        try
        {
            await using var stream = file.OpenReadStream(MaxBytes);

            FileReference reference = await StorageService.UploadAsync(
                content:     stream,
                fileName:    file.Name,
                contentType: file.ContentType,
                ownerUserId: _currentUserId,
                sizeBytes:   file.Size,
                visibility:  StorageFileVisibility.UserFile);

            _coverImageUrl = reference.Url;
            Snackbar.Add("Image uploaded.", Severity.Success);
        }
        catch (Exception)
        {
            Snackbar.Add("Upload failed. Please try again.", Severity.Error);
        }
    }
}
```

`IStorageService.UploadAsync` returns a `FileReference` that exposes `Url` (the resolvable public URL) and `FileId` (a `Guid` for later metadata lookups or deletion).

This pattern requires approximately 30 lines and has zero additional package dependencies beyond `Storage.Contracts`.

#### Pattern B — Host composes `BwFileUploadButton` as a `RenderFragment` slot

When you want to reuse `BwFileUploadButton`'s built-in loading spinner and snackbar error handling, the host (which already references all UI packages) can own the button instance and pass it into the feature module's page as a `RenderFragment` parameter.

Feature module page — declares a slot (only `Storage.Contracts` referenced):

```razor
@* Feature module page — slot for an externally provided upload widget *@

@if (UploadWidget is not null)
{
    @UploadWidget
}

@code {
    /// <summary>Provided by the host. Renders the upload button without a direct UI package reference.</summary>
    [Parameter] public RenderFragment? UploadWidget { get; set; }

    /// <summary>Called by the host after a successful upload.</summary>
    [Parameter] public EventCallback<FileReference> OnUploaded { get; set; }
}
```

Host wrapper — composes `BwFileUploadButton` into the slot (host references `Storage.UI.MudBlazor`):

```razor
@* Host wrapper page — fills the feature module's upload slot *@

<ProjectsAdminPage OnUploaded="@HandleUploaded">
    <UploadWidget>
        <BwFileUploadButton
            Accept="image/*"
            MaxFileSizeMb="10"
            UploadImmediately="true"
            Visibility="StorageFileVisibility.UserFile"
            OwnerUserId="@_userId"
            OnUploaded="@(r => InvokeAsync(() => HandleUploaded(r)))" />
    </UploadWidget>
</ProjectsAdminPage>

@code {
    private string? _userId; // from auth state

    private void HandleUploaded(FileReference reference)
    {
        // notify feature module or update host-level state
    }
}
```

::: tip When to use which pattern
- Use **Pattern A** (contracts-only) for the majority of cases. It is self-contained, testable, and requires no coordination between host and feature module. If your feature module already depends on MudBlazor, there is no reason to avoid `MudFileUpload`.
- Use **Pattern B** (host-composed slot) only when you explicitly want to centralise upload error handling in the host and avoid duplicating snackbar/spinner logic across multiple feature modules. The trade-off is that the host must know about and wire up each upload slot.
:::

::: warning Do not add a new abstractions package
`FileReference` and `StorageFileVisibility` already live in `Storage.Contracts`. An extra `Storage.UI.Abstractions` package for an upload-widget interface would solve the same problem as Pattern A with significant added maintenance overhead. Use Pattern A.
:::

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
