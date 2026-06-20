# Getting Started

Der schnellste Einstieg ist ein Template — es scaffoldet einen lauffähigen Startpunkt inklusive des vollständigen SDK-Startup-Flows (`AddBieberWorksModules`, `MapBieberWorksModules`, `BwThemeProvider`) und einem Beispiel-Modul als Orientierung.

## Voraussetzungen

- **.NET 10 SDK** — `dotnet --version` muss `10.x` zeigen
- **GitHub PAT** mit Scope `read:packages` für die Org `BieberWorks` — wird für `dotnet restore` benötigt

## Templates installieren

```powershell
dotnet new install BieberWorks.Templates
```

Danach stehen alle fünf Templates unter `dotnet new bw-*` zur Verfügung.

## Verfügbare Templates

| Template | Anwendungsfall | Befehl |
|---|---|---|
| `bw-api` | REST-API ohne UI | `dotnet new bw-api -n MeinProjekt` |
| `bw-blazor` | Blazor Server App | `dotnet new bw-blazor -n MeinProjekt` |
| `bw-wasm-api` | WASM Frontend + API Backend | `dotnet new bw-wasm-api -n MeinProjekt` |
| `bw-wasm` | WASM Client für externe API | `dotnet new bw-wasm -n MeinClient` |
| `bw-module` | Einzelnes Modul in bestehender Solution | `dotnet new bw-module -n MeinModul` |

## Weiterführende Seiten

- [Template-Referenz](./templates) — vollständige Dokumentation aller Templates inkl. Projektstruktur, enthaltene Pakete und Nächste-Schritte-Listen
- [Manuelle Integration](./manual-setup) — Schritt-für-Schritt-Anleitung für die Integration ohne Template (z.B. in eine bestehende Solution)
