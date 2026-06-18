# Setup & Configuration

## NuGet installation

### Minimal setup (FileSystem provider)

```bash
dotnet add package BieberWorks.SDK.Storage.Contracts
dotnet add package BieberWorks.SDK.Storage
```

### With UI (MudBlazor)

```bash
dotnet add package BieberWorks.SDK.Storage.UI.MudBlazor
```

### With AWS S3

```bash
dotnet add package BieberWorks.SDK.Storage.Aws
```

### With Azure Blob Storage

```bash
dotnet add package BieberWorks.SDK.Storage.Azure
```

::: info Package source
All packages are in GitHub Packages of the `BieberWorks` organization. A `nuget.config` with the `bieberworks` feed and a valid `PACKAGES_TOKEN` is required.
:::

## Program.cs

### Step 1: Register the module

`StorageModule` implements `IModule` and `IEndpointModule`. Registration via `AddBieberWorksModules`:

```csharp
builder.Services.AddBieberWorksModules(builder.Configuration);
```

`StorageModule.RegisterServices` is called automatically and registers:

- `IDbContextFactory<StorageDbContext>` (Npgsql, schema `storage`)
- `IFileStorage` (default: `FileSystemFileStorage`)
- `IStorageKeyStrategy` (default: `DateStorageKeyStrategy`)
- `IStorageService`
- `IStorageSettingsService`
- `IAvatarProvider` (`StorageAvatarProvider`)
- `IPermissionContributor` (`StoragePermissionContributor`)

### Step 2: Choose provider (optional)

FileSystem provider is default and needs no explicit setup. To activate a different provider, call **after** `AddBieberWorksModules`:

```csharp
// AWS S3
builder.Services.AddS3Storage(builder.Configuration);

// Azure Blob Storage
builder.Services.AddAzureBlobStorage(builder.Configuration);

// DB-Blob (no further parameter needed)
builder.Services.AddDatabaseStorage();
```

::: tip Last call wins
All provider registrations replace `IFileStorage`. Only the last registered provider is active.
:::

### Step 3: Register UI (optional)

```csharp
builder.Services.AddStorageUi(opts =>
{
    // Optional: link to user detail page in admin (owner column)
    opts.UserLinkTemplate = "/admin/users/{0}";

    // Optional: permission user must have for link to render
    opts.UserLinkPermission = "auth:users:manage";
});
```

### Step 4: Map endpoints and migrations

```csharp
app.MapBieberWorksModules();
await app.InitializeBieberWorksModulesAsync(); // runs StorageDbContext.MigrateAsync
```

### Step 5: Register Razor assemblies (if using UI)

```csharp
app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode()
    .AddAdditionalAssemblies(
        typeof(BieberWorks.SDK.Storage.UI.MudBlazor.Pages.Admin.AllFilesPage).Assembly
    );
```

And in `Routes.razor`:

```razor
<Router AppAssembly="typeof(App).Assembly"
        AdditionalAssemblies="new[] { typeof(BieberWorks.SDK.Storage.UI.MudBlazor.Pages.Admin.AllFilesPage).Assembly }">
```

## appsettings.json

### Database connection

```json
{
  "ConnectionStrings": {
    "StorageDb": "Host=localhost;Database=bieberworks;Username=app;Password=..."
  }
}
```

::: tip Fallback logic
`StorageModule` searches connection strings in this order: `StorageDb` → `DefaultConnection` → `AuthDb`. A dedicated `StorageDb` string is recommended, but not required.
:::

### FileSystem provider

```json
{
  "Storage": {
    "FileSystem": {
      "RootPath": "App_Data/storage"
    }
  }
}
```

`RootPath` can be absolute or relative to the application content root. Default: `App_Data/storage`.

### Key strategy

```json
{
  "Storage": {
    "KeyStrategy": "Date"
  }
}
```

Possible values: `Date` (default), `Owner`, `Hybrid`. See [Key strategy](./key-strategy.md).

### Allowed visibility modes (upload UI)

```json
{
  "Storage": {
    "Sharing": {
      "AllowedVisibilities": ["Private", "Public"]
    }
  }
}
```

Restricts which visibility modes are offered in the upload UI. Default: all three modes (`Private`, `RoleRestricted`, `Public`). `AppResource` is never selectable in the UI.

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

`AccessKeyId` and `SecretAccessKey` can be left empty — then the standard AWS credential chain applies (IAM role, environment variables, etc.).

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

Alternatively, `ServiceUri` for managed identity / token credential.

## Migrations note

`StorageModule` implements `IModuleInitializer`. When `InitializeBieberWorksModulesAsync()` is called, `StorageDbContext.Database.MigrateAsync()` is executed. This automatically creates schema `storage` and all tables:

| Table | Purpose |
|---|---|
| `storage.storage_files` | File metadata (name, size, content-type, owner, visibility) |
| `storage.file_blobs` | Blob bytes (only populated by DB-Blob provider) |
| `storage.storage_settings` | Module-wide settings (allowed content types) |

::: warning EF migrations and `--no-build`
Never call `dotnet ef` with `--no-build` — stale DLLs produce faulty migrations.
:::
