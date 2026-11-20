# Providers

The Storage module separates logical file API (`IStorageService`) from physical storage (`IFileStorage`). The provider is exchangeable without changing domain or service code.

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

`SaveAsync` returns the actually used key (for FileSystem provider, identical to input key). `OpenReadAsync` throws `FileNotFoundException` if no object exists under the key. `DeleteAsync` is a no-op if the key doesn't exist.

---

## FileSystem Provider

**Default provider.** No additional package needed — included in `BieberWorks.SDK.Storage`.

### Configuration

```json
{
  "Storage": {
    "FileSystem": {
      "RootPath": "App_Data/storage"
    }
  }
}
```

`RootPath` is resolved to absolute path on startup (`Path.GetFullPath`). The directory is automatically created if it doesn't exist.

### Path-traversal protection

The FileSystem provider defends against path-traversal attacks on two levels:

1. Backslashes in keys are normalized to forward slashes (protects on Linux against `..\\..\\` attacks).
2. After `Path.GetFullPath`, it checks whether the resolved path is inside `RootPath`. A sibling directory like `/storage-root-evil/` is correctly rejected because the separator suffix is checked explicitly.

```csharp
// Internal check (simplified):
if (!fullPath.StartsWith(_rootPath + Path.DirectorySeparatorChar, StringComparison.Ordinal)
    && fullPath != _rootPath)
{
    throw new InvalidOperationException("Possible path-traversal attempt.");
}
```

### When to use

- Local development
- Single server with persistent volume (Docker, VM)
- Deployments without cloud dependency

---

## DB-Blob Provider

Stores file bytes in the `storage.file_blobs` table of the same PostgreSQL database as metadata.

### Activation

```csharp
builder.Services.AddDatabaseStorage();
```

No `appsettings.json` entry needed — uses the same `StorageDbContext`.

### How it works

On save, the stream is fully buffered into a `byte[]` and saved as one row in `storage.file_blobs`. On read, a `MemoryStream` over the bytes is returned.

::: warning RAM limitation
Since each file is fully loaded into RAM, the DB-Blob provider suits only small files. Avatars (typically < 1 MB) are the main use case.
:::

### When to use

- Avatars and small binary files
- Deployments without filesystem volume or cloud storage account
- When atomic backup (DB dump safeguards bytes and metadata together) is important

---

## AWS S3 Provider

Package: `BieberWorks.SDK.Storage.Aws`

### Activation

```csharp
builder.Services.AddS3Storage(builder.Configuration);
```

### Configuration

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

| Option | Description | Default |
|---|---|---|
| `BucketName` | S3 bucket name (required) | `""` |
| `KeyPrefix` | Optional prefix before each object key | `""` |
| `Region` | AWS region | `"us-east-1"` |
| `AccessKeyId` | AWS access key ID (empty = credential chain) | `""` |
| `SecretAccessKey` | AWS secret access key (empty = credential chain) | `""` |
| `ServiceUrl` | Custom endpoint (MinIO, Hetzner, etc.) | `null` |
| `ForcePathStyle` | Path-style addressing vs. virtual-hosted | `false` |

::: tip S3-compatible services
`ServiceUrl` and `ForcePathStyle: true` enable use with MinIO, Hetzner Object Storage, and other S3-compatible backends.
:::

::: warning Secrets not in appsettings.json
`AccessKeyId` and `SecretAccessKey` belong in a secret store (User Secrets, Azure Key Vault, AWS Secrets Manager) or AWS credential chain (IAM role) — not in versioned config files.
:::

### When to use

- Production deployments with horizontal scaling
- Existing AWS infrastructure
- S3-compatible on-premises solution (MinIO)

---

## Azure Blob Storage Provider

Package: `BieberWorks.SDK.Storage.Azure`

### Activation

```csharp
builder.Services.AddAzureBlobStorage(builder.Configuration);
```

### Configuration

**Option A: Connection string**

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

**Option B: Managed identity (recommended for Azure deployments)**

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

| Option | Description | Default |
|---|---|---|
| `ConnectionString` | Storage account connection string | `null` |
| `ServiceUri` | Service URI for managed identity | `null` |
| `ContainerName` | Target container (created if missing) | `"storage"` |

::: info ConnectionString vs. ServiceUri
If `ConnectionString` is set, it takes precedence. `ServiceUri` with managed identity is the recommended approach for Azure deployments — no key in code or config.
:::

### When to use

- Production deployments on Azure
- Azure infrastructure with managed identity
