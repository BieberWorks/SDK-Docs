# Key-Strategie & Sichtbarkeit

## IStorageKeyStrategy

`IStorageKeyStrategy` bestimmt, unter welchem physischen Pfad (Key) eine Datei im Backend gespeichert wird. Der Key ist der einzige Bezugspunkt zwischen Metadaten-Index (`storage_files.StorageKey`) und dem physischen Objekt — er ändert sich nach dem Upload nie mehr.

```csharp
public interface IStorageKeyStrategy
{
    string BuildKey(Guid fileId, string fileName, Guid? ownerUserId);
}
```

- `fileId` garantiert Kollisionsfreiheit (wird immer in den Key eingebettet).
- `fileName` wird auf den Dateinamen-Anteil reduziert (`Path.GetFileName`) — Verzeichnis-Segmente im Original-Dateinamen werden entfernt.
- `ownerUserId` ist `null` für systemseitige / unzugeordnete Dateien (wird als `shared` dargestellt).

### Eingebaute Strategien

Drei Strategien sind im Modul enthalten und über `appsettings.json` wählbar:

| Name | Key-Format | Konfigurationswert |
|---|---|---|
| `DateStorageKeyStrategy` | `yyyy/MM/dd/{id}_{name}` | `Date` (Standard) |
| `OwnerStorageKeyStrategy` | `{ownerId}/{id}_{name}` | `Owner` |
| `HybridStorageKeyStrategy` | `{ownerId}/yyyy/MM/{id}_{name}` | `Hybrid` |

#### Beispiele

```
Date:   2026/06/18/3f4a1b2c3d4e5f6a7b8c9d0e1f2a3b4c_report.pdf
Owner:  a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6/3f4a1b2c3d4e5f6a7b8c9d0e1f2a3b4c_report.pdf
Hybrid: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6/2026/06/3f4a1b2c3d4e5f6a7b8c9d0e1f2a3b4c_report.pdf
```

### Konfiguration

```json
{
  "Storage": {
    "KeyStrategy": "Date"
  }
}
```

### Eigene Strategie

`IStorageKeyStrategy` kann nach `AddBieberWorksModules` durch eine eigene Implementierung ersetzt werden:

```csharp
builder.Services.AddBieberWorksModules(builder.Configuration);

// Eigene Strategie überschreibt die Modul-Registrierung:
builder.Services.AddSingleton<IStorageKeyStrategy, MyCustomKeyStrategy>();
```

::: warning Key ist unveränderlich
Der Key wird beim ersten Upload berechnet und in der Datenbank persistiert. Eine spätere Änderung der Strategie betrifft nur neue Uploads — bestehende Dateien behalten ihren alten Key. Der `StorageKey` in den Metadaten ist immer die autoritative Referenz.
:::

---

## Sichtbarkeit (StorageFileVisibility)

Jede Datei hat eine Sichtbarkeitsstufe, die steuert, wer ausser dem Owner und Storage-Admins auf sie zugreifen darf.

```csharp
public enum StorageFileVisibility
{
    Private = 0,         // Nur Owner und Admins
    RoleRestricted = 1,  // Authentifizierte User mit einer der erlaubten Rollen
    Public = 2,          // Alle authentifizierten User
    AppResource = 3,     // Internes App-Asset (Avatar, Logo, …)
}
```

| Wert | Wer hat Zugriff | Erscheint in User-Listen | Erscheint in Admin-Listen |
|---|---|---|---|
| `Private` | Owner + Admins | Ja (Owner sieht seine eigenen) | Ja |
| `RoleRestricted` | Owner + Admins + User mit erlaubter Rolle | Ja | Ja |
| `Public` | Owner + Admins + alle Auth. User | Ja | Ja |
| `AppResource` | Alle mit `storage:file:read`-Permission | Nein | Nur wenn "Show internal" aktiviert |

### Sichtbarkeit beim Upload setzen

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

### Sichtbarkeit nachträglich ändern

```csharp
var updated = await storageService.UpdateVisibilityAsync(
    fileId,
    StorageFileVisibility.Public,
    allowedRoles: null
);
```

`allowedRoles` wird für andere Modi als `RoleRestricted` ignoriert und als leere Liste gespeichert.

### Host-seitige Einschränkung

Der Host kann einschränken, welche Modi die Upload-UI anbietet — ohne die Enforcement-Logik zu verändern:

```json
{
  "Storage": {
    "Sharing": {
      "AllowedVisibilities": ["Private", "Public"]
    }
  }
}
```

`AppResource` ist niemals über die Upload-UI auswählbar und taucht nicht in `AllowedVisibilities` auf.

---

## IAvatarProvider

`StorageModule` registriert `StorageAvatarProvider` als `IAvatarProvider` (Interface aus `SDK-Auth.Contracts`). Andere Module (z.B. SDK-Auth) können `IAvatarProvider` injizieren, ohne das Storage-Paket zu kennen.

### Verhalten

- Jeder User hat maximal einen Avatar: eine Datei mit `FileName == "avatar"` und `ContentType` beginnend mit `"image/"`, `OwnerUserId` = User-Guid.
- Sichtbarkeit: immer `AppResource` — der Avatar-Download ist über `/storage/files/{fileId}/download` erreichbar, aber er erscheint nicht in normalen Dateilisten.
- Ein neuer Upload löscht den vorherigen Avatar automatisch (Overwrite-Semantik).
- `GetAvatarUrlAsync` gibt den relativen Download-Pfad zurück oder `null` wenn kein Avatar existiert.

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

::: tip sizeBytes beim Upload pflichtend
HTTP-Multipart-Upload-Streams sind nicht seekbar. Daher muss `sizeBytes` explizit übergeben werden (z.B. `IFormFile.Length`), damit die gespeicherte Dateigrösse korrekt ist.
:::
