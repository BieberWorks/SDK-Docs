# SDK-Pages — Changelog

## v1.0.1

### fix: remove transitive AngleSharp/HtmlSanitizer dependency from Pages.UI

**Problem:** `BieberWorks.SDK.Pages.UI` transitively pulled in `HtmlSanitizer 9.0.892`,
which requires `AngleSharp = 0.17.1`. Consumer test projects that use bUnit 2.7+ (which
itself depends on `AngleSharp >= 1.4.0`) received `NU1608` version-downgrade warnings.
These warnings could not be suppressed without consumer-side `<NoWarn>` entries.

**Root cause:** `SDK-Components/Components.UI` incorrectly held a direct `ProjectReference`
to the `Components` implementation project (which owns `HtmlSanitizer`). This caused the
sanitizer dependency to flow transitively through:

```
Pages.UI → Components.UI → Components (impl) → HtmlSanitizer 9.x → AngleSharp 0.17.1
```

**Fix (in SDK-Components):**

- Removed the `ProjectReference` to `Components.csproj` from `Components.UI.csproj`.
  `Components.UI` now references only `Components.Contracts`.
- Removed the `AddModule<ComponentsModule>` wiring from `ComponentsUiModule` (the `.UI`
  layer is now a pure base-class / contract consumer with no impl dependency).
- Added the `ProjectReference` to `Components.csproj` directly in
  `Components.UI.MudBlazor.csproj`.
- `ComponentsUiMudBlazorModule` now calls both `AddModule<ComponentsModule>` and
  `AddModule<ComponentsUiModule>` so the full impl + UI chain is wired when the
  MudBlazor layer is consumed.

**Sanitizing is fully preserved:** `HtmlSanitizer` (via `Ganss.Xss`) is still used by
`MarkdigParser` in the implementation assembly. Only the transitive NuGet graph changed —
at runtime the sanitizer DLL is present via `BieberWorks.SDK.Components`.

**Consumer impact:** bUnit test projects that reference `Pages.UI` (or any package that
depends on it) no longer receive `NU1608` for `AngleSharp`. No consumer-side `<NoWarn>`
entries are required.

---

## v1.0.0

Initial release of SDK-Pages.
