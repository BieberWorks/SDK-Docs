# Setup & Konfiguration

## NuGet-Installation

### Minimales Setup (FileSystem-Provider)

```bash
dotnet add package BieberWorks.SDK.Storage.Contracts
dotnet add package BieberWorks.SDK.Storage
```

### Mit UI (MudBlazor)

```bash
dotnet add package BieberWorks.SDK.Storage.UI.MudBlazor
```

### Mit AWS S3

```bash
dotnet add package BieberWorks.SDK.Storage.Aws
```

### Mit Azure Blob Storage

```bash
dotnet add package BieberWorks.SDK.Storage.Azure
```

::: info Paketquelle
Alle Pakete liegen in GitHub Packages der Organisation `BieberWorks`. Eine `nuget.config` mit dem `bieberworks`-Feed und einem gültigen `PACKAGES_TOKEN` ist Voraussetzung.
:::

## Program.cs

### Schritt 1: Modul registrieren

`StorageModule` implementiert `IModule` und `IEndpointModule`. Die Registrierung erfolgt über `AddBieberWorksModules`:

```csharp
builder.Services.AddBieberWorksModules(builder.Configuration);
```

`StorageModule.RegisterServices` wird dabei automatisch aufgerufen und registriert:

- `IDbContextFactory<StorageDbContext>` (Npgsql, Schema `storage`)
- `IFileStorage` (Standard: `FileSystemFileStorage`)
- `IStorageKeyStrategy` (Standard: `DateStorageKeyStrategy`)
- `IStorageService`
- `IStorageSettingsService`
- `IAvatarProvider` (`StorageAvatarProvider`)
- `IPermissionContributor` (`StoragePermissionContributor`)

### Schritt 2: Provider wählen (optional)

Der FileSystem-Provider ist der Standard und muss nicht explizit gesetzt werden. Um einen anderen Provider zu aktivieren, wird **nach** `AddBieberWorksModules` aufgerufen:

```csharp
// AWS S3
builder.Services.AddS3Storage(builder.Configuration);

// Azure Blob Storage
builder.Services.AddAzureBlobStorage(builder.Configuration);

// DB-Blob (kein weiterer Parameter nötig)
builder.Services.AddDatabaseStorage();
```

::: tip Letzter Aufruf gewinnt
Alle Provider-Registrierungen ersetzen `IFileStorage`. Nur der zuletzt registrierte Provider ist aktiv.
:::

### Schritt 3: UI registrieren (optional)

```csharp
builder.Services.AddStorageUi(opts =>
{
    // Optionaler Link auf User-Detailseite im Admin (Owner-Spalte)
    opts.UserLinkTemplate = "/admin/users/{0}";

    // Optionale Permission, die der User haben muss, damit der Link gerendert wird
    opts.UserLinkPermission = "auth:users:manage";
});
```

### Schritt 4: Endpoints und Migrations

```csharp
app.MapBieberWorksModules();
await app.InitializeBieberWorksModulesAsync(); // führt StorageDbContext.MigrateAsync aus
```

### Schritt 5: Razor-Assemblies registrieren (wenn UI verwendet)

```csharp
app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode()
    .AddAdditionalAssemblies(
        typeof(BieberWorks.SDK.Storage.UI.MudBlazor.Pages.Admin.AllFilesPage).Assembly
    );
```

Und in `Routes.razor`:

```razor
<Router AppAssembly="typeof(App).Assembly"
        AdditionalAssemblies="new[] { typeof(BieberWorks.SDK.Storage.UI.MudBlazor.Pages.Admin.AllFilesPage).Assembly }">
```

## appsettings.json

### Datenbankverbindung

```json
{
  "ConnectionStrings": {
    "StorageDb": "Host=localhost;Database=bieberworks;Username=app;Password=..."
  }
}
```

::: tip Fallback-Logik
`StorageModule` sucht Verbindungsstrings in dieser Reihenfolge: `StorageDb` → `DefaultConnection` → `AuthDb`. Ein dedizierter `StorageDb`-String ist empfohlen, aber nicht zwingend.
:::

### FileSystem-Provider

```json
{
  "Storage": {
    "FileSystem": {
      "RootPath": "App_Data/storage"
    }
  }
}
```

`RootPath` kann absolut oder relativ zum Application Content Root angegeben werden. Standard: `App_Data/storage`.

### Key-Strategie

```json
{
  "Storage": {
    "KeyStrategy": "Date"
  }
}
```

Mögliche Werte: `Date` (Standard), `Owner`, `Hybrid`. Siehe [Key-Strategie](./key-strategy.md).

### Erlaubte Sichtbarkeitsmodi (Upload-UI)

```json
{
  "Storage": {
    "Sharing": {
      "AllowedVisibilities": ["Private", "Public"]
    }
  }
}
```

Schränkt ein, welche Sichtbarkeitsmodi in der Upload-UI angeboten werden. Standard: alle drei Modi (`Private`, `RoleRestricted`, `Public`). `AppResource` ist nie in der UI auswählbar.

### AWS S3

```json
{
  "Storage": {
    "S3": {
      "BucketName": "my-bucket",
      "KeyPrefix": "uploads/",
      "AccessKeyId": "",
      "SecretAccessKey": "",
      "Region": "eu-central-1",
      "ServiceUrl": null,
      "ForcePathStyle": false
    }
  }
}
```

`AccessKeyId` und `SecretAccessKey` können leer gelassen werden — dann greift die Standard-AWS-Credential-Chain (IAM Role, Environment Variables, etc.).

### Azure Blob Storage

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

Alternativ zu `ConnectionString` kann `ServiceUri` für Managed Identity / Token Credential verwendet werden.

## Migrations-Hinweis

`StorageModule` implementiert `IModuleInitializer`. Beim Aufruf von `InitializeBieberWorksModulesAsync()` wird `StorageDbContext.Database.MigrateAsync()` ausgeführt. Das legt automatisch das Schema `storage` und alle Tabellen an:

| Tabelle | Zweck |
|---|---|
| `storage.storage_files` | Datei-Metadaten (Name, Grösse, Content-Type, Owner, Sichtbarkeit) |
| `storage.file_blobs` | Blob-Bytes (nur bei DB-Blob-Provider befüllt) |
| `storage.storage_settings` | Modul-weite Einstellungen (erlaubte Content-Types) |

::: warning EF-Migrations und `--no-build`
`dotnet ef` niemals mit `--no-build` aufrufen — veraltete DLLs erzeugen fehlerhafte Migrations-Dateien.
:::
