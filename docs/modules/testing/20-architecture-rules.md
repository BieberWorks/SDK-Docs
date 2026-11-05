# Architecture rules

`ModuleGraph.Load` reads assembly files (no `Assembly.Load`) via `System.Reflection.Metadata`.
Roles are derived from the assembly name suffix (longest first): `.UI.Blazor.MudBlazor`,
`.UI.Blazor`, `.Presentation`, `.Client`, `.Contracts`, otherwise `Impl`. Further UI technologies
can be added with `ModuleGraphOptions.ExtraUiSuffixes`. Assemblies matching `SharedPrefixes`
(Foundation, UI base, ...) may be referenced by every module. Defaults: `Core`, `SharedKernel`,
`Persistence`, `UI`, `Presentation`, `Shell`, `Components` and the whole `Testing` family
(all `BieberWorks.SDK.<Name>` and `BieberWorks.SDK.<Name>.*`; matching is on dot boundaries, so
`ShellExtras` is not shared). `Theme` is deliberately not shared.

## Sub-assemblies

`ModuleGraphOptions.SubAssemblyOf` maps a sub-assembly key (assembly name without role suffix) to its
parent module (`SubAssembly(Parent, FrontendSafe)`). The sub-assembly then counts as the parent's
implementation, so references between parent and sub-assembly are not "foreign". Defaults:

| Key | Parent | FrontendSafe |
|---|---|---|
| `BieberWorks.SDK.Auth.Session` | `BieberWorks.SDK.Auth` | yes |
| `BieberWorks.SDK.Auth.Management` | `BieberWorks.SDK.Auth` | no |
| `BieberWorks.SDK.Import.Jobs` | `BieberWorks.SDK.Import` | no |

`FrontendSafe` marks a client-side/host component (no EF, no identity, e.g. the Blazor circuit session
listener) that the parent's own UI/Client/Presentation may reference without
`FrontendDoesNotReferenceImpl`. It does not open the parent's real implementation, other sub-assemblies,
or foreign modules. Setting your own mapping replaces the defaults (start from
`ModuleGraphOptions.DefaultSubAssemblies` to extend them).

| Rule | Meaning |
|---|---|
| `NoForeignImplReference` | A module never references another module's implementation. |
| `UiHasNoDbContext` | UI/Presentation assemblies have no EF Core reference. |
| `UiReferencesOnlyForeignContracts` | UI uses foreign `.Contracts` only; MudBlazor layer depends on Blazor, not vice versa. |
| `FrontendDoesNotReferenceImpl` | `.Client`/`.UI.*`/`.Presentation` never reference their own Impl. |
| `NoCycles` | The assembly reference graph is acyclic. |
| `ContractsNoEfOrAspNetImpl` | `.Contracts` have no EF Core / ASP.NET implementation dependency. |

```csharp
var graph = ModuleGraph.Load(new ModuleGraphOptions { Paths = [AppContext.BaseDirectory] });
var violations = ArchitectureRules.Evaluate(graph);   // report mode: never throws
ArchitectureRules.EnsureNoViolations(violations);     // strict mode: throws with readable message
```

Allowlist entries (`AllowlistEntry`) require a reason and may carry an expiry date; expired
entries no longer suppress and are reported as `AllowlistExpired`.
