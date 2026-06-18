# Provider

Das Storage-Modul trennt die logische Datei-API (`IStorageService`) von der physischen Speicherung (`IFileStorage`). Der Provider ist austauschbar, ohne dass Domain- oder Service-Code angepasst werden muss.

## IFileStorage

```csharp
public interface IFileStorage
{
    Task<string> SaveAsync(Stream content, string key, string contentType, CancellationToken ct = default);
    Task<Stream> OpenReadAsync(string key, CancellationToken ct = default);
    Task DeleteAsync(string key, CancellationToken ct = default);
    Task<bool> ExistsAsync(string key, CancellationToken ct = default);
}
```

`SaveAsync` gibt den tatsächlich verwendeten Key zurück (beim FileSystem-Provider identisch mit dem Eingabe-Key). `OpenReadAsync` wirft `FileNotFoundException` wenn kein Objekt unter dem Key existiert. `DeleteAsync` ist ein No-Op wenn der Key nicht vorhanden ist.

---

## FileSystem-Provider

**Standard-Provider.** Kein zusätzliches Paket nötig — in `BieberWorks.SDK.Storage` enthalten.

### Konfiguration

```json
{
  "Storage": {
    "FileSystem": {
      "RootPath": "App_Data/storage"
    }
  }
}
```

`RootPath` wird beim Start zu einem absoluten Pfad aufgelöst (`Path.GetFullPath`). Das Verzeichnis wird automatisch erstellt falls es nicht existiert.

### Path-Traversal-Schutz

Der FileSystem-Provider wehrt Path-Traversal-Angriffe auf zwei Ebenen ab:

1. Backslashes im Key werden zu Forward-Slashes normalisiert (schützt auf Linux gegen `..\\..\\`-Angriffe).
2. Nach `Path.GetFullPath` wird geprüft, ob der aufgelöste Pfad innerhalb von `RootPath` liegt. Ein Sibling-Verzeichnis wie `/storage-root-evil/` wird dabei korrekt abgelehnt, weil der Trennzeichen-Suffix explizit geprüft wird.

```csharp
// Interne Prüfung (vereinfacht):
if (!fullPath.StartsWith(_rootPath + Path.DirectorySeparatorChar, StringComparison.Ordinal)
    && fullPath != _rootPath)
{
    throw new InvalidOperationException("Possible path-traversal attempt.");
}
```

### Wann verwenden

- Lokale Entwicklung
- Einzelner Server mit persistentem Volume (Docker, VM)
- Deployments ohne Cloud-Abhängigkeit

---

## DB-Blob-Provider

Speichert Datei-Bytes in der Tabelle `storage.file_blobs` derselben PostgreSQL-Datenbank, in der auch die Metadaten liegen.

### Aktivieren

```csharp
builder.Services.AddDatabaseStorage();
```

Kein `appsettings.json`-Eintrag nötig — nutzt denselben `StorageDbContext`.

### Wie es funktioniert

Beim Speichern wird der Stream vollständig in einen `byte[]`-Puffer geladen und als eine Zeile in `storage.file_blobs` gespeichert. Beim Lesen wird ein `MemoryStream` über die Bytes zurückgegeben.

::: warning RAM-Limitierung
Da jede Datei vollständig in den RAM geladen wird, eignet sich der DB-Blob-Provider nur für kleine Dateien. Avatare (typisch < 1 MB) sind der Hauptanwendungsfall.
:::

### Wann verwenden

- Avatare und kleine Binärdateien
- Deployments ohne Filesystem-Volume oder Cloud-Storage-Account
- Wenn atomares Backup (DB-Dump sichert Bytes und Metadaten gemeinsam) wichtig ist

---

## AWS S3 Provider

Paket: `BieberWorks.SDK.Storage.Aws`

### Aktivieren

```csharp
builder.Services.AddS3Storage(builder.Configuration);
```

### Konfiguration

```json
{
  "Storage": {
    "S3": {
      "BucketName": "my-bucket",
      "KeyPrefix": "uploads/",
      "Region": "eu-central-1",
      "AccessKeyId": "",
      "SecretAccessKey": "",
      "ServiceUrl": null,
      "ForcePathStyle": false
    }
  }
}
```

| Option | Beschreibung | Standard |
|---|---|---|
| `BucketName` | Name des S3-Buckets (Pflicht) | `""` |
| `KeyPrefix` | Optionaler Prefix vor jedem Object-Key | `""` |
| `Region` | AWS-Region | `"us-east-1"` |
| `AccessKeyId` | AWS Access Key ID (leer = Credential Chain) | `""` |
| `SecretAccessKey` | AWS Secret Access Key (leer = Credential Chain) | `""` |
| `ServiceUrl` | Custom Endpoint (MinIO, Hetzner, etc.) | `null` |
| `ForcePathStyle` | Path-Style Addressing statt Virtual-Hosted | `false` |

::: tip S3-kompatible Dienste
`ServiceUrl` und `ForcePathStyle: true` ermöglichen den Einsatz mit MinIO, Hetzner Object Storage und anderen S3-kompatiblen Backends.
:::

::: warning Secrets nicht in appsettings.json
`AccessKeyId` und `SecretAccessKey` gehören in einen Secret Store (z.B. User Secrets, Azure Key Vault, AWS Secrets Manager) oder in die AWS-Credential-Chain (IAM Role) — nicht in versionierte Konfigurationsdateien.
:::

### Wann verwenden

- Produktions-Deployments mit horizontaler Skalierung
- Bestehende AWS-Infrastruktur
- S3-kompatible On-Premises-Lösung (MinIO)

---

## Azure Blob Storage Provider

Paket: `BieberWorks.SDK.Storage.Azure`

### Aktivieren

```csharp
builder.Services.AddAzureBlobStorage(builder.Configuration);
```

### Konfiguration

**Option A: Connection String**

```json
{
  "Storage": {
    "AzureBlob": {
      "ConnectionString": "DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net",
      "ContainerName": "storage"
    }
  }
}
```

**Option B: Managed Identity (empfohlen für Azure-Deployments)**

```json
{
  "Storage": {
    "AzureBlob": {
      "ServiceUri": "https://<account>.blob.core.windows.net",
      "ContainerName": "storage"
    }
  }
}
```

| Option | Beschreibung | Standard |
|---|---|---|
| `ConnectionString` | Storage Account Connection String | `null` |
| `ServiceUri` | Service URI für Managed Identity | `null` |
| `ContainerName` | Ziel-Container (wird erstellt falls nicht vorhanden) | `"storage"` |

::: info ConnectionString vs. ServiceUri
Wenn `ConnectionString` gesetzt ist, wird es bevorzugt. `ServiceUri` zusammen mit Managed Identity ist die empfohlene Variante für Azure-Deployments — kein Key im Code oder in der Konfiguration nötig.
:::

### Wann verwenden

- Produktions-Deployments auf Azure
- Azure-Infrastruktur mit Managed Identity
