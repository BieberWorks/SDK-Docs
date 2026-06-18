# SDK-Storage

Das Storage-Modul stellt eine vollständige, provider-unabhängige Dateiverwaltung für BieberWorks SDK-Anwendungen bereit. Es umfasst Upload, Download, Metadaten-Verwaltung, Sichtbarkeitskontrolle, automatisches Auditing und eine fertige MudBlazor-UI.

## Was das Modul bietet

- **Einheitliche High-Level-API** (`IStorageService`) für Upload, Download, Listing, Umbenennen, Sichtbarkeit und Löschen
- **Austauschbarer physischer Backend** über `IFileStorage` — ohne Änderungen am Domain- oder Service-Code
- **Vier eingebaute Provider:** FileSystem, DB-Blob, AWS S3, Azure Blob Storage
- **Konfigurierbare Key-Strategie** (`IStorageKeyStrategy`): Datum, Owner oder Hybrid
- **Vier Sichtbarkeitsstufen** (Private, RoleRestricted, Public, AppResource)
- **Automatisches Auditing** — alle Datei-Events implementieren `IAuditableEvent`; kein Audit-Code pro Event nötig
- **Avatar-Integration** — implementiert `IAvatarProvider` aus `SDK-Auth.Contracts`
- **Erlaubte Content-Types** verwaltbar über Admin-UI oder Konfiguration
- **Fertige MudBlazor-Seiten** für Admin und Benutzer

## Paket-Tabelle

| Paket | Beschreibung | Version |
|---|---|---|
| `BieberWorks.SDK.Storage.Contracts` | Interfaces, DTOs, Domain Events, Permissions — wird von anderen Modulen referenziert | ![v0.1.1](https://img.shields.io/badge/version-0.1.1-blue) |
| `BieberWorks.SDK.Storage` | Kern-Implementierung: FileSystem-Provider, DB-Blob-Provider, `StorageModule`, Migrations (Schema `storage`) | ![v0.1.1](https://img.shields.io/badge/version-0.1.1-blue) |
| `BieberWorks.SDK.Storage.Aws` | AWS S3 / S3-kompatibler Provider (`S3FileStorage`) | ![v0.1.1](https://img.shields.io/badge/version-0.1.1-blue) |
| `BieberWorks.SDK.Storage.Azure` | Azure Blob Storage Provider (`AzureBlobFileStorage`) | ![v0.1.1](https://img.shields.io/badge/version-0.1.1-blue) |
| `BieberWorks.SDK.Storage.UI.MudBlazor` | Admin-Seiten, Benutzer-Seiten, Shared-Komponenten (MudBlazor RCL) | ![v0.1.1](https://img.shields.io/badge/version-0.1.1-blue) |

::: tip Contracts-First
Andere Module referenzieren ausschliesslich `BieberWorks.SDK.Storage.Contracts`. Die Implementierungs-Pakete kennt nur der Host.
:::

## Provider-Vergleich

| Kriterium | FileSystem | DB-Blob | AWS S3 | Azure Blob |
|---|---|---|---|---|
| **Einsatz** | Entwicklung, Einzel-Server | Avatare, kleine Dateien | Cloud-Scale-Out | Cloud-Scale-Out (Azure) |
| **Skalierung** | Einzelner Server | Einzelner DB-Server | Horizontal | Horizontal |
| **Transaktional mit Metadaten** | Nein | Ja | Nein | Nein |
| **Dateigrösse** | Unbegrenzt (Disk) | Klein empfohlen (RAM-Puffer) | Gross | Gross |
| **Backup** | Manuell / Volume | Mit DB-Backup | S3-Versionierung | Azure-Redundanz |
| **S3-kompatibel (MinIO etc.)** | — | — | Ja | — |

::: warning DB-Blob und grosse Dateien
`DatabaseFileStorage` liest jede Datei vollständig in den RAM (`MemoryStream`). Für Dateien über wenige MB den FileSystem-, S3- oder Azure-Provider verwenden.
:::
