# Key strategy & visibility

## IStorageKeyStrategy

`IStorageKeyStrategy` determines under which physical path (key) a file is stored in the backend. The key is the only reference between metadata index (`storage_files.StorageKey`) and the physical object — it never changes after upload.

```csharp
public interface IStorageKeyStrategy
{
    string BuildKey(Guid fileId, string fileName, Guid? ownerUserId);
}
```

- `fileId` guarantees collision freedom (always embedded in the key).
- `fileName` is reduced to the filename part (`Path.GetFileName`) — directory segments in the original filename are removed.
- `ownerUserId` is `null` for system / unassigned files (shown as `shared`).

### Built-in strategies

Three strategies are included and selectable via `appsettings.json`:

| Name | Key format | Config value |
|---|---|---|
| `DateStorageKeyStrategy` | `yyyy/MM/dd/{id}_{name}` | `Date` (default) |
| `OwnerStorageKeyStrategy` | `{ownerId}/{id}_{name}` | `Owner` |
| `HybridStorageKeyStrategy` | `{ownerId}/yyyy/MM/{id}_{name}` | `Hybrid` |

#### Examples

File IDs and owner IDs are embedded as 32-character lowercase hex strings (`Guid.ToString("N")`, no hyphens):

```
Date:   2026/06/18/3f4a1b2c3d4e5f6a7b8c9d0e1f2a3b4c_report.pdf
Owner:  a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6/3f4a1b2c3d4e5f6a7b8c9d0e1f2a3b4c_report.pdf
Hybrid: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6/2026/06/3f4a1b2c3d4e5f6a7b8c9d0e1f2a3b4c_report.pdf
```

### Configuration

```json
{
  "Storage": {
    "KeyStrategy": "Date"
  }
}
```

### Custom strategy

`IStorageKeyStrategy` can be replaced with a custom implementation after `AddBieberWorksModules`:

```csharp
builder.Services.AddBieberWorksModules(builder.Configuration);

// Custom strategy overrides module registration:
builder.Services.AddSingleton<IStorageKeyStrategy, MyCustomKeyStrategy>();
```

::: warning Key is immutable
The key is calculated on first upload and persisted in the database. Changing the strategy later only affects new uploads — existing files retain their old key. The `StorageKey` in metadata is always authoritative.
:::

---

## Visibility (StorageFileVisibility)

Each file has a visibility level controlling who besides the owner and storage admins can access it.

```csharp
public enum StorageFileVisibility
{
    Private = 0,         // Owner and admins only
    RoleRestricted = 1,  // Authenticated users with allowed roles
    Public = 2,          // All authenticated users
    AppResource = 3,     // Internal app asset (avatar, logo, …)
}
```

| Value | Who has access | Appears in user lists | Appears in admin lists |
|---|---|---|---|
| `Private` | Owner + admins | Yes (owner sees own) | Yes |
| `RoleRestricted` | Owner + admins + users with allowed role | Yes | Yes |
| `Public` | Owner + admins + all auth. users | Yes | Yes |
| `AppResource` | All with `storage:file:read` permission | No | Only if "Show internal" enabled |

### Set visibility on upload

```csharp
var fileRef = await storageService.UploadAsync(
    stream,
    "document.pdf",
    "application/pdf",
    ownerUserId: currentUserId,
    sizeBytes: file.Size,
    visibility: StorageFileVisibility.RoleRestricted,
    allowedRoles: new[] { "Manager", "Admin" }
);
```

### Change visibility later

```csharp
var updated = await storageService.UpdateVisibilityAsync(
    fileId,
    StorageFileVisibility.Public,
    allowedRoles: null
);
```

`allowedRoles` is ignored for modes other than `RoleRestricted` and saved as an empty list.

### Host-side restriction

The host can restrict which modes the upload UI offers — without changing enforcement logic:

```json
{
  "Storage": {
    "Sharing": {
      "AllowedVisibilities": ["Private", "Public"]
    }
  }
}
```

`AppResource` is never selectable in the upload UI and does not appear in `AllowedVisibilities`.

---

## IAvatarProvider

`StorageModule` registers `StorageAvatarProvider` as `IAvatarProvider` (interface from `SDK-Auth.Contracts`). Other modules (e.g. SDK-Auth) can inject `IAvatarProvider` without knowing the Storage package.

### Behavior

- Each user has at most one avatar: a file with `FileName == "avatar"` and `ContentType` starting with `"image/"`, `OwnerUserId` = user GUID.
- Visibility: always `AppResource` — avatar download is available at `/storage/files/{fileId}/download`, but it doesn't appear in normal file lists.
- A new upload deletes the previous avatar automatically (overwrite semantics).
- `GetAvatarUrlAsync` returns the relative download path or `null` if no avatar exists.

### Interface

```csharp
public interface IAvatarProvider
{
    Task<string?> GetAvatarUrlAsync(string userId, CancellationToken ct = default);

    Task UploadAvatarAsync(
        string userId,
        Stream content,
        string contentType,
        long sizeBytes,
        CancellationToken ct = default);

    Task DeleteAvatarAsync(string userId, CancellationToken ct = default);
}
```

::: tip sizeBytes mandatory on upload
HTTP multipart upload streams are not seekable. Therefore, `sizeBytes` must be passed explicitly (e.g. `IFormFile.Length`) so the persisted file size is correct.
:::
