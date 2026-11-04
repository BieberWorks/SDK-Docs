# Architecture rules

`ModuleGraph.Load` reads assembly files (no `Assembly.Load`) via `System.Reflection.Metadata`.
Roles are derived from the assembly name suffix (longest first): `.UI.Blazor.MudBlazor`,
`.UI.Blazor`, `.Presentation`, `.Client`, `.Contracts`, otherwise `Impl`. Further UI technologies
can be added with `ModuleGraphOptions.ExtraUiSuffixes`. Assemblies matching `SharedPrefixes`
(Foundation, UI base, ...) may be referenced by every module.

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
