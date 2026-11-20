---
layout: home

hero:
  name: BieberWorks SDK
  text: Modular .NET NuGet Ecosystem
  tagline: Self-registering modules, per-module PostgreSQL schemas, Blazor MudBlazor UI included. No Microservices overhead — one deployable, pluggable by NuGet.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/BieberWorks

features:
  - title: Self-Registering Modules
    details: Every module implements IModule and wires itself into DI via AddBieberWorksModules(). Drop in a NuGet package and it appears — no manual service registration in the host.
    link: /modules/foundation/imodule
  - title: Per-Module PostgreSQL Schemas
    details: Each module owns its own DbContext and schema (auth, audit, storage, …). Cross-module access via IDs, events, and Contracts only — never DB-JOIN.
    link: /guide/cross-module
  - title: Auto-Auditing via IAuditableEvent
    details: Domain events implementing IAuditableEvent are captured automatically by SDK-Audit's open-generic handler. Zero audit code per event, zero coupling to SDK-Audit.
    link: /modules/audit/auto-auditing
  - title: Blazor MudBlazor UI Included
    details: Auth pages, Admin shell, Account shell, Notification bell, Storage browser, Localization editor — all shipped as MudBlazor RCLs.
    link: /modules/ui/
---

## Modules

<ModuleGrid />

## Current Stable Versions

<VersionTable />

All packages are published to GitHub Packages under the `BieberWorks` organization. See [NuGet Access](/guide/nuget-access) for setup instructions.
