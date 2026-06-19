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
  - title: Foundation
    details: Core abstractions — IModule, Messaging (IAppMessageDispatcher, IDomainEventPublisher), SharedKernel (Result, IDomainEvent, IAuditableEvent).
    link: /modules/foundation/
  - title: Account
    details: Account shell with extensible navigation for user-facing pages via IAccountSection.
    link: /modules/account/
  - title: Admin
    details: Admin shell with drag-and-drop navigation and permission-based access via IAdminSection.
    link: /modules/admin/
  - title: Auth
    details: Cookie + JWT dual-scheme authentication, roles, fine-grained permissions, MudBlazor pages.
    link: /modules/auth/
  - title: Email
    details: Pluggable email sending with MailKit SMTP provider, template system, LoggingEmailSender fallback.
    link: /modules/email/
  - title: Localization
    details: DB-backed i18n with IMemoryCache layer and admin translation editor. Override any .resx string at runtime.
    link: /modules/localization/
  - title: Notifications
    details: In-App and Email notifications via INotifiableEvent, SignalR bell, configurable channels per event type.
    link: /modules/notifications/
  - title: Settings
    details: DB-backed app settings and feature flags with IMemoryCache and admin CRUD UI.
    link: /modules/settings/
  - title: Storage
    details: File and blob storage with FileSystem, DB-Blob, Azure, and AWS S3 providers. Visibility control, MudBlazor UI.
    link: /modules/storage/
  - title: UI
    details: BwThemeProvider, BwShellLayout, IAppBarWidget, DarkModeToggle, LanguageSwitcher, component override system.
    link: /modules/ui/
---

## Current Stable Versions

| Module | Version |
|---|---|
| SDK-Foundation | v0.7.1 |
| SDK-Auth | v0.16.0 |
| SDK-Email | v0.6.0 |
| SDK-Audit | v0.3.0 |
| SDK-UI | v0.8.0 |
| SDK-Admin | v0.10.2 |
| SDK-Localization | v0.5.1 |
| SDK-Storage | v0.7.0 |
| SDK-Account | v0.5.0 |
| SDK-Settings | v0.3.0 |
| SDK-Notifications | v0.5.0 |

All packages are published to GitHub Packages under the `BieberWorks` organization. See [NuGet Access](/guide/nuget-access) for setup instructions.
