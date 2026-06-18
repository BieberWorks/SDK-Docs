# Navigation Features

## Edit Mode

**Access:** Pencil button in drawer header (only for users with `admin:shell:access` permission)

In edit mode, users can:

- Reorder sections via drag-and-drop
- Create, rename, and delete folders
- Move sections into folders
- Drag sections out of folders

**View (Normal Mode):** All groups are collapsed by default. Navigation shows only registered `IAdminSection` instances and their nav items.

## Custom Folders

### Create Folder

1. Enable edit mode
2. Click "Add folder" button
3. Enter folder name
4. Press Enter or click checkmark icon

### Move Section into Folder

1. Section or folder is draggable with hamburger handle (⋮⋮)
2. Drag over folder to inner **drop zone**
3. Section appears in folder

### Reorder Section in Folder

Sections in a folder have a hamburger handle. Reordering via drag-and-drop — identical to top level.

### Move Section Out of Folder

Each section in a folder has an **up arrow button** (↑). Click moves the section one level up (out of folder to top level, directly after the folder).

### Rename Folder

1. Click pencil icon in folder header
2. Text becomes editable
3. Press Enter to save or click outside

### Delete Folder

1. Click trash icon
2. Confirmation (only if folder contains sections)
3. Folder is deleted, sections fall back to top level (directly after the folder)

## Persistence via SDK-Settings

### Storage Location

Key: `admin.nav.section-order`  
Location: SDK-Settings (database `settings` schema)

### JSON Format v2

```json
{
  "version": 2,
  "entries": [
    { "kind": "section", "typeName": "MyNamespace.MyAdminSection" },
    {
      "kind": "folder",
      "folderId": "a1b2c3d4",
      "displayName": "My Folder",
      "children": [
        "MyNamespace.OtherAdminSection",
        "Another.Module.AdminSection"
      ]
    }
  ]
}
```

**Field Explanation:**
- `version` — format version (currently: 2)
- `entries` — array of sections and folders
- `folderId` — unique folder ID (8-character GUID)
- `children` — array of type names (sections in folder)

### Migration from Old Format

The old format was a flat array of type names:

```json
["MyNamespace.Section1", "MyNamespace.Section2"]
```

Deserialization recognizes the old format automatically and converts it to v2. On next save, it is written as v2.

### Without SDK-Settings

If `ISettingsService` is not available:
- Navigation is not persisted
- Edit mode works (changes are ephemeral)
- Each reload restores the default order

## Notes for Module Developers

### Order Property

The `IAdminSection.Order` property determines only the **default order** before users edit the navigation. Once users save the structure, `Order` is ignored.

New sections registered after the first user edit appear **automatically at the end** of the saved structure. They are not inserted by their `Order`.

### Example

1. Module A with `Order: 100` is registered → Navigation: [A]
2. User saves structure
3. Module B with `Order: 50` is registered → Navigation: [A, B] (B at end, not before A)

### Graceful Fallback

If the saved structure is corrupted (e.g., invalid JSON), deserialization fails gracefully:
- Corrupted entries are ignored
- Known sections are still shown
- Edit mode functions normally

See `AdminLayout.razor.cs`, line 291: `catch { /* Ignore corrupted data */ }`
