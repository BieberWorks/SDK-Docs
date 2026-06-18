# UI-Komponenten

Paket: `BieberWorks.SDK.Storage.UI.MudBlazor`

Das UI-Paket stellt fertige MudBlazor-Seiten für Admin und Benutzer bereit. Es setzt `SDK-Admin` (für `IAdminSection`/`IAdminPage`) und `SDK-Account` (für `IAccountSection`/`IAccountPage`) voraus.

## Einbinden

### 1. Service-Registrierung

```csharp
builder.Services.AddStorageUi(opts =>
{
    // Optional: Link auf User-Detailseite in der Owner-Spalte der Admin-Ansicht
    opts.UserLinkTemplate = "/admin/users/{0}";  // {0} = User-Guid

    // Optional: Permission, die der aktuelle User benötigt, damit der Link gerendert wird
    opts.UserLinkPermission = "auth:users:manage";
});
```

Ohne `configure`-Parameter werden `UserLinkTemplate` und `UserLinkPermission` auf `null` gesetzt — Owner-IDs werden dann als Klartext angezeigt.

### 2. Razor-Assembly in Program.cs

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

::: warning Beide Einträge sind Pflicht
Fehlt der Assembly-Eintrag in `MapRazorComponents`, werden die Seiten nicht gefunden. Fehlt der Eintrag im `Router`, zeigt Blazor "Not found" beim direkten Navigieren zur URL.
:::

---

## Admin-Seiten

### Alle Dateien — `/admin/files`

**Permission:** `storage:file:admin`

Die zentrale Datei-Verwaltungsseite für Administratoren. Zeigt alle Dateien aller Benutzer.

Funktionen:
- Tabellen-Ansicht mit Name, Grösse, Content-Type, Sichtbarkeit, Owner, Upload-Datum
- Quicksearch (Name / Content-Type, debounced 300 ms)
- Sichtbarkeitsfilter für den Upload
- Datei-Upload mit Sichtbarkeits-Auswahl (konfigurierbar via `StorageSharingOptions`)
- Rollen-Feld erscheint bei `RoleRestricted`-Sichtbarkeit (kommagetrennte Rollennamen)
- Toggle "Show internal" — zeigt `AppResource`-Dateien (Avatare, Logos)
- Download und Löschen (mit Bestätigungsdialog) pro Zeile
- Klick auf eine Zeile navigiert zu `/admin/files/{fileId}`
- Owner-Spalte mit optionalem Link (via `StorageUiOptions.UserLinkTemplate`)
- Erlaubte Content-Types werden aus `IStorageSettingsService` geladen; `accept`-Attribut und Hint-Text werden automatisch gesetzt
- Max. Upload-Grösse: 50 MB

### Datei-Detail — `/admin/files/{fileId}`

**Permission:** `storage:file:admin`

Detailansicht einer einzelnen Datei mit Metadaten, Sichtbarkeits-Änderung und Löschen.

### Storage-Einstellungen — `/admin/storage/settings`

**Permission:** `storage:settings:manage`

Verwaltung der modul-weiten Einstellungen.

Funktionen:
- Anzeige der aktuell erlaubten Content-Types als entfernbare Chips
- Manuelles Hinzufügen via Textfeld (Enter oder Button)
- Quick-Presets: `image/*`, `application/pdf`, `text/*`, Word, Excel, PowerPoint, ZIP, JSON
- Speichern persistiert die Liste in `storage.storage_settings` via `IStorageSettingsService`

::: info Leere Liste = alles erlaubt
Wenn die Allowed-Types-Liste leer ist, sind alle Content-Types zugelassen. Das ist der Ausgangszustand nach der ersten Migration.
:::

---

## Account-Seiten (Benutzer)

### Meine Dateien — `/account/files`

**Permission:** `storage:file:read`

Datei-Verwaltung für den angemeldeten Benutzer. Zeigt ausschliesslich Dateien des aktuellen Users.

Funktionen:
- Tabellen-Ansicht mit Name, Grösse, Content-Type, Sichtbarkeit, Upload-Datum
- Quicksearch
- Datei-Upload mit Sichtbarkeits-Auswahl
- Rollen-Feld bei `RoleRestricted`
- Download und Löschen pro Zeile
- Klick auf Zeile navigiert zu `/account/files/{fileId}`
- Max. Upload-Grösse: 50 MB

### Meine Datei-Detail — `/account/files/{fileId}`

**Permission:** `storage:file:read`

Detailansicht der eigenen Datei mit Metadaten, Umbenennen, Sichtbarkeits-Änderung und Löschen.

### Geteilte Dateien — `/account/shared-files`

Dateien, die mit dem aktuellen User geteilt wurden (Public oder RoleRestricted mit passender Rolle).

### Geteilte Datei-Detail — `/account/shared-files/{fileId}`

Detailansicht einer geteilten Datei (nur lesend).

---

## Shared-Komponenten

### FileDetailView

Wiederverwendbare Detailansicht für eine einzelne Datei. Wird von den Admin- und Account-Detail-Seiten genutzt.

---

## Permissions-Übersicht

| Permission | Schlüssel | Zweck |
|---|---|---|
| `StoragePermissions.FileRead` | `storage:file:read` | Eigene Dateien anzeigen / herunterladen |
| `StoragePermissions.FileWrite` | `storage:file:write` | Eigene Dateien hochladen |
| `StoragePermissions.FileDelete` | `storage:file:delete` | Eigene Dateien löschen |
| `StoragePermissions.FileAdmin` | `storage:file:admin` | Alle Dateien verwalten (Admin) |
| `StoragePermissions.FileSettingsManage` | `storage:settings:manage` | Modul-Einstellungen verwalten |

Die Permissions werden über `StoragePermissionContributor` (implementiert `IPermissionContributor`) automatisch im Auth-Permissions-Katalog registriert. Rollen können diesen Permissions in der Admin-UI von SDK-Auth zugewiesen werden.

::: tip Policy-Präfix
Alle `[Authorize(Policy = "...")]`-Attribute in den Razor-Seiten verwenden das Präfix `perm:` (z.B. `perm:storage:file:admin`). Das entspricht der Konvention des SDK-Auth-Moduls.
:::
