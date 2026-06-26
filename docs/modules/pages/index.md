# Pages

SDK-Pages is a modular CMS component for static content pages (Imprint, About, FAQ, Privacy Policy, and similar). It provides full admin CRUD, public routing with configurable prefixes, provider-based seeding, role-based visibility, and automatic auditing via `IAuditableEvent`.

## What the module offers

- **Admin CRUD** — create, edit, publish, unpublish, and delete pages via permission-gated admin pages under `/admin/pages`
- **Multilingual content** — per-page translations (`Title`, `Body`, `MetaDescription`) keyed by BCP-47 culture code, with automatic culture resolution and fallback
- **Public routing** — `PublicPage.razor` handles `/p/{slug}` (default) or `/{slug}`, plus optional per-category prefixes such as `/blog/{slug}`
- **IPageProvider seeding** — consumer modules declare static pages; Pages seeds them idempotently on startup
- **RequiredRole visibility** — optional role restriction on public pages; unauthenticated users are redirected to login, authenticated users without the role see an access-denied message
- **IRoleProvider integration** — the role dropdown in the admin UI is populated by any registered `IRoleProvider` (implemented by SDK-Auth); Pages works without SDK-Auth (free-text fallback)
- **RouteConflictValidator** — optional callback to block slugs that conflict with existing host routes
- **Auto-auditing** — all five domain events implement `IAuditableEvent`; SDK-Audit logs them automatically when installed
- **Permission-gated service layer** — `IPageAdminService` enforces permissions at the service level, not only in the UI

## Package overview

| Package | Description | When needed |
|---|---|---|
| `BieberWorks.SDK.Pages.Contracts` | Interfaces, DTOs, domain events, permissions, `IPageProvider`, `IRoleProvider`, `PagesOptions` | When another module registers an `IPageProvider` or injects `IPageService` |
| `BieberWorks.SDK.Pages` | EF entity, `PagesDbContext`, migrations, services, `PagesModule` | In the host that owns the pages database |
| `BieberWorks.SDK.Pages.UI` | Framework-agnostic `ComponentBase` base classes | Transitively — referenced by `.UI.MudBlazor` |
| `BieberWorks.SDK.Pages.UI.MudBlazor` | Razor components, admin section registration, localization resources | When using the built-in admin and public page UI |

## When to use which package

| Scenario | Required packages |
|---|---|
| Another module seeds static pages via `IPageProvider` | `Pages.Contracts` |
| Another module reads published pages via `IPageService` | `Pages.Contracts` |
| Host owns the pages database and admin API | `Pages` |
| Host with built-in Blazor admin UI and public page rendering | `Pages` + `Pages.UI.MudBlazor` |

## Documentation

| Topic | Document |
|---|---|
| NuGet setup, `Program.cs`, assembly registration, `appsettings.json`, migrations | [Getting Started](getting-started.md) |
| `PageEntity`, `PageTranslationEntity`, `PageDto`, culture resolution, v0.0.4 migration guide | [Content Model](content-model.md) |
| `IPageProvider`, `ManagedPage`, seeding behavior, multi-language providers, `AllowAdminEdit` | [Page Provider](page-provider.md) |
| Admin routes, list page, create/edit forms, `AllowAdminEdit` banner, section registration | [Admin UI](admin-ui.md) |
| `PagesOptions`, `PageRouteHelper`, category prefixes, `RouteConflictValidator`, Blazor router limitation | [Routing](routing.md) |
| `PublicPage.razor`, 404 semantics, `RequiredRole` flow, `PagesAccessDenied` component | [Public Route](public-route.md) |
| `RequiredRole`, `IRoleProvider`, `IEnumerable` pattern, public access flow, admin UI visibility | [Role-Based Access](role-access.md) |
| Permission keys, service-layer enforcement, UI gating, authorization policies | [Permissions](permissions.md) |
| Localization keys, resource files, DB override via SDK-Localization | [Localization](localization.md) |
| Domain events, `IAuditableEvent`, audit details, seeding exclusion | [Events & Auditing](events-auditing.md) |
| Release history | [Changelog](CHANGES.md) |
