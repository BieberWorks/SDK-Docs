# Testing Conventions

Every SDK module is tested the same way. The shared helpers live in the `BieberWorks.SDK.Testing*` packages (repo `SDK-Testing`, see the [Testing module](/modules/testing/)); reference implementations are `SDK-Webhooks`, `SDK-Jobs` and `SDK-Notifications`.

## Stack

| Concern | Choice |
|---|---|
| Test framework | `xunit.v3` with `<OutputType>Exe</OutputType>` in the test project |
| Assertions | Shouldly (`value.ShouldBe(expected)`) |
| Mocking | NSubstitute |
| Blazor components | bUnit 2.x (through `BwBunitContext`) |
| Helpers | `BieberWorks.SDK.Testing`, `.Testing.Blazor`, `.Testing.Architecture`, `.Testing.ClientContracts` |

Add the helper packages to test projects only, never to production projects. The test project keeps its own `xunit.v3` and `Shouldly` references.

```xml
<PackageReference Include="BieberWorks.SDK.Testing" Version="0.*-*" />
<PackageReference Include="BieberWorks.SDK.Testing.Architecture" Version="0.*-*" />
<PackageReference Include="BieberWorks.SDK.Testing.ClientContracts" Version="0.*-*" />
<PackageReference Include="BieberWorks.SDK.Testing.Blazor" Version="0.*-*" />
```

::: warning EF InMemory version alignment
`Microsoft.EntityFrameworkCore.InMemory` in the test project must match the EF Core version the module uses. A lower version in the test project causes NU1605 (package downgrade); align it with the module's EF Core version.
:::

## BieberWorks.SDK.Testing helpers

| Helper | Purpose |
|---|---|
| `InMemoryDb` | `CreateFactory<T>()` / `CreateContext<T>()` for EF InMemory. Each call without an explicit name gets a unique database; `TransactionIgnoredWarning` is suppressed. |
| `TestCurrentUser` | `Admin()`, `WithPermissions("a", "b")`, `Anonymous`. A `ClaimsPrincipal` using the claim types of the Foundation permission service (`sub`/`NameIdentifier`, `perm`, `role`). `*` grants everything in the catalog. |
| `TestAuthHandler` | Authentication scheme `Test`. Request headers `X-Test-User`, `X-Test-Permissions`, `X-Test-Roles` (comma separated). No `X-Test-User` means anonymous. |
| `FakeLocalizers` | `Error()` returns an `IErrorLocalizer` that yields the error code; `Strings<T>()` returns an `IStringLocalizer<T>` that yields the key. |
| `TestPrincipalAccessor` | An `ICurrentPrincipalAccessor` with a settable `User` (default anonymous). |
| `BwTestHost` | A `WebApplication` on `TestServer` with your module(s) registered. |

### BwTestHost

```csharp
await using var host = BwTestHost.Create(typeof(MyModule).Assembly);
var http = host.CreateClient(TestCurrentUser.WithPermissions("my:read"));   // HTTP transport
using var scope = host.CreateScope(TestCurrentUser.Admin());                // in-process transport
```

`BwTestHost` registers modules from the given assemblies, swaps every registered `DbContext` options registration to EF InMemory (pooled context factories are not swapped), makes `Test` the default authentication scheme, maps the module endpoints and registers `AddBieberWorksAuthorization()` (permission service and `perm:*` policies). Unless a module registers its own, a key-returning `IErrorLocalizer` fake is added.

Principal behaviour: `TestPrincipalAccessor` replaces the `Core.Web` accessors as the scoped `ICurrentPrincipalAccessor`.

- `host.CreateScope(user)` returns a service scope whose accessor yields `user` (use this for in-process clients).
- `host.CreateClient(user)` sends the user as test headers; inside that HTTP request the accessor returns the authenticated `HttpContext.User`, so handlers see the same caller over HTTP.
- With no authenticated request the accessor falls back to its `User`, which defaults to anonymous.

## InMemory vs Postgres

EF InMemory is the default for unit and endpoint tests: fast and zero setup. It does **not** enforce relational constraints (unique indexes, foreign keys, check constraints) and has no schemas, real transactions, raw SQL, `jsonb` or Postgres-specific functions. Anything that depends on those needs a real PostgreSQL, started with Testcontainers in an integration test that is clearly separated (own class or project, so the fast suite stays fast). Do not assert constraint behaviour against InMemory: the test would pass for the wrong reason.

## Permission and IDOR tests

Every endpoint and client method that takes an identifier needs these tests, using the `TestCurrentUser` variants:

1. Success with the required permission.
2. `Anonymous` is rejected (401 / `Unauthorized`).
3. A user without the permission is rejected (403 / `Forbidden`).
4. IDOR: user A reads, changes or deletes a resource owned by user B and must get `NotFound` or `Forbidden`, never the data. Assert that nothing was modified.
5. DTOs never leak secrets (compare `WebhookEndpointDtoSecretLeakTests` in SDK-Webhooks).

## Blazor tests

Derive from `BwBunitContext` (package `Testing.Blazor`) instead of repeating the MudBlazor setup. It registers MudBlazor services, loose JSInterop, fake `ILayoutThemeContext` / `IThemeModeService`, a passthrough `IShellIconResolver`, bUnit authorization (`SetUser(TestCurrentUser)`, default `Admin()`; policies `perm:<permission>`), the localizer fakes and a `TestPrincipalAccessor`.

```csharp
public sealed class AccountLayoutTests : BwBunitContext
{
    public AccountLayoutTests() : base(TestCurrentUser.WithPermissions("account:read")) { }

    [Fact]
    public void Renders_body()
    {
        RenderMudProviders();
        var cut = Render<AccountLayout>(p => p.Add(c => c.Body, ...));
        cut.FindAll("#body").Count.ShouldBe(1);
    }
}
```

`BwThemeProvider` is never rendered by the context (it exists once, in the host's `Routes.razor`); verify layouts through the `LayoutTheme` fake. Register module-specific services via `Services`.

## Architecture tests

`BieberWorks.SDK.Testing.Architecture` reads the compiled assembly graph (no `Assembly.Load`) and checks module layering. The module template includes an `*.ArchitectureTests` project in strict mode by default.

| Rule | Meaning |
|---|---|
| `NoForeignImplReference` | A module never references another module's implementation. |
| `UiHasNoDbContext` | UI/Presentation assemblies have no EF Core reference. |
| `UiReferencesOnlyForeignContracts` | UI uses foreign `.Contracts` only; the MudBlazor layer depends on Blazor, not vice versa. |
| `FrontendDoesNotReferenceImpl` | `.Client` / `.UI.*` / `.Presentation` never reference their own implementation. |
| `NoCycles` | The assembly reference graph is acyclic. |
| `ContractsNoEfOrAspNetImpl` | `.Contracts` have no EF Core / ASP.NET implementation dependency. |

```csharp
var graph = ModuleGraph.Load(new ModuleGraphOptions { Paths = [AppContext.BaseDirectory] });
var violations = ArchitectureRules.Evaluate(graph);   // report mode: never throws
ArchitectureRules.EnsureNoViolations(violations);     // strict mode: throws with a readable message
```

- **Report vs strict:** `Evaluate` only returns violations (useful when introducing the rules to an existing repo); `EnsureNoViolations` fails the test. Modules should be strict.
- **Roles** come from the assembly name suffix (`.UI.Blazor.MudBlazor`, `.UI.Blazor`, `.Presentation`, `.Client`, `.Contracts`, otherwise implementation). More UI technologies can be added via `ModuleGraphOptions.ExtraUiSuffixes`.
- **SharedPrefixes:** assemblies matching `SharedPrefixes` (Foundation, UI base, ...) may be referenced by every module.
- **Allowlist:** an `AllowlistEntry` suppresses a known violation and **requires a reason**; it may carry an **expiry date**. Expired entries stop suppressing and are reported as `AllowlistExpired`. Use it only as a dated, justified exception, never as a permanent opt-out.

## Contract tests

A module client has an in-process and an HTTP transport that must behave identically (see [Client Pattern](/guide/client-pattern)). `BieberWorks.SDK.Testing.ClientContracts` provides `ClientContractTests<TClient>`, which runs one scenario over both transports and compares success, error type and error code.

```csharp
public sealed class WalletClientContractTests : ClientContractTests<IWalletClient>
{
    private readonly BwTestHost _host = ...;   // register with Own(...) to dispose

    public static IEnumerable<object[]> Transports => TransportKinds.Data;

    protected override Task<IWalletClient> CreateAsync(TransportKind kind, TestCurrentUser user) { ... }

    [Fact]
    public Task NotFound_is_identical()
        => AssertSameAsync("missing wallet", TestCurrentUser.Admin(), c => c.GetAsync(Guid.NewGuid()),
            ClientOutcome.Failed(DomainErrorType.NotFound, "Wallet.NotFound"));

    [Theory, MemberData(nameof(Transports))]
    public async Task Anonymous_is_unauthenticated(TransportKind kind)
        => (await RunAsync(kind, TestCurrentUser.Anonymous, c => c.GetAsync(Guid.NewGuid())))
            .ErrorType.ShouldBe(DomainErrorType.Unauthorized);
}
```

::: warning Expose the MemberData source on your own class
Always declare `public static IEnumerable<object[]> Transports => TransportKinds.Data;` on your test class and point `[MemberData(nameof(Transports))]` at it. Pointing `MemberType` at `TransportKinds` from another assembly makes the xunit analyzer `MemberDataShouldReferenceValidMember` crash (AD0001).
:::

Cover at least: success, NotFound, Forbidden, Unauthenticated and Validation. Use records for DTOs (success values are compared with `Equals`). Messages and `RetryAfter` are not compared.

## Naming scheme

- Test project: `BieberWorks.SDK.<Module>.Tests` (and `...ArchitectureTests`), folder `tests/`.
- Test class: `<TypeUnderTest>Tests`; contract tests `<Module>ClientContractTests`; bUnit tests `<Component>Tests`.
- Test method: a readable snake-case sentence such as `Anonymous_is_unauthenticated` or `NotFound_is_identical`.
- Every test asserts something meaningful.
