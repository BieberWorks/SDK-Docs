# SDK-Storage

The Storage module provides complete, provider-independent file management for BieberWorks SDK applications. It includes upload, download, metadata management, visibility control, automatic auditing, and ready-made MudBlazor UI.

## What the module offers

- **Unified high-level API** (`IStorageService`) for upload, download, listing, rename, visibility, and delete
- **Exchangeable physical backend** via `IFileStorage` — without changes to domain or service code
- **Four built-in providers:** FileSystem, DB-Blob, AWS S3, Azure Blob Storage
- **Configurable key strategy** (`IStorageKeyStrategy`): Date, Owner, or Hybrid
- **Four visibility levels** (Private, RoleRestricted, Public, AppResource)
- **Automatic auditing** — all file events implement `IAuditableEvent`; no audit code per event needed
- **Avatar integration** — implements `IAvatarProvider` from `SDK-Auth.Contracts`
- **Allowed content types** manageable via admin UI or configuration
- **Ready-made MudBlazor pages** for admin and users

## Package table

Current versions are published on the [GitHub Releases page](https://github.com/BieberWorks/SDK-Storage/releases).

| Package | Description |
|---|---|
| `BieberWorks.SDK.Storage.Contracts` | Interfaces, DTOs, domain events, permissions — referenced by other modules |
| `BieberWorks.SDK.Storage` | Core implementation: FileSystem provider, DB-Blob provider, `StorageModule`, migrations (schema `storage`) |
| `BieberWorks.SDK.Storage.Aws` | AWS S3 / S3-compatible provider (`S3FileStorage`) |
| `BieberWorks.SDK.Storage.Azure` | Azure Blob Storage provider (`AzureBlobFileStorage`) |
| `BieberWorks.SDK.Storage.UI.MudBlazor` | Admin pages, user pages, shared components (MudBlazor RCL) |

::: tip Contracts-First
Other modules reference only `BieberWorks.SDK.Storage.Contracts`. Implementation packages are known only to the host.
:::

## Provider comparison

| Criterion | FileSystem | DB-Blob | AWS S3 | Azure Blob |
|---|---|---|---|---|
| **Use case** | Development, single server | Avatars, small files | Cloud scale-out | Cloud scale-out (Azure) |
| **Scaling** | Single server | Single DB server | Horizontal | Horizontal |
| **Transactional with metadata** | No | Yes | No | No |
| **File size** | Unlimited (disk) | Small recommended (RAM buffer) | Large | Large |
| **Backup** | Manual / volume | With DB backup | S3 versioning | Azure redundancy |
| **S3-compatible (MinIO etc.)** | — | — | Yes | — |

::: warning DB-Blob and large files
`DatabaseFileStorage` reads every file fully into RAM (`MemoryStream`). For files over a few MB, use FileSystem, S3, or Azure provider.
:::

## Documentation

| Topic | File |
|---|---|
| Setup & Configuration | [setup.md](./setup.md) |
| Providers (FileSystem, DB-Blob, S3, Azure) | [providers.md](./providers.md) |
| Key Strategy & Visibility | [key-strategy.md](./key-strategy.md) |
| Public Image Streaming Endpoint | [public-image-endpoint.md](./public-image-endpoint.md) |
| UI Components (MudBlazor) | [ui-components.md](./ui-components.md) |
| GDPR / Privacy | [gdpr-privacy.md](./gdpr-privacy.md) |
