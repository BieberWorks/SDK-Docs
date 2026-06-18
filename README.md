# SDK-Docs

Teil des **BieberWorks SDK** - privates, modulares .NET-Fundament.
Veroeffentlicht als NuGet-Paket(e) in den **GitHub Packages** der Organisation `BieberWorks` (token-geschuetzt).

## Installation

In `nuget.config` die private Quelle ergaenzen:

```xml
<add key="bieberworks" value="https://nuget.pkg.github.com/BieberWorks/index.json" />
```

Authentifizierung via PAT mit `read:packages` (NICHT committen):

```powershell
dotnet nuget add source "https://nuget.pkg.github.com/BieberWorks/index.json" `
  --name bieberworks --username p-bieber --password <PAT> --store-password-in-clear-text
```

Dann: `dotnet add package <Paketname>`

## Branch-Flow

`main` <- `staging` <- `dev`  (Default-Branch: `dev`)
Feature-Branch -> PR gegen `dev` -> `staging` -> `main` (Release).

## Versionierung & Release

Push auf `main` taggt automatisch (SemVer) und veroeffentlicht die Pakete.
`staging` erzeugt `-rc` Pre-Releases.

## Lizenz

Proprietaer - siehe [LICENSE](./LICENSE).
