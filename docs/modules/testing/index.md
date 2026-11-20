# SDK-Testing

Shared test infrastructure for SDK modules. Neither package pulls in xunit or Shouldly
transitively; consumers keep their own test-framework references.

## Packages

- `BieberWorks.SDK.Testing` - `InMemoryDb`, `TestCurrentUser`, `TestAuthHandler`, `TestPrincipalAccessor`, `FakeLocalizers`, `BwTestHost`.
- `BieberWorks.SDK.Testing.Architecture` - `ModuleGraph` + `ArchitectureRules`, based on assembly metadata only.
- `BieberWorks.SDK.Testing.ClientContracts` - `ClientContractTests<TClient>`: one scenario over the InProc and HTTP transport.
- `BieberWorks.SDK.Testing.Blazor` - `BwBunitContext`: bUnit context for SDK UI components (MudBlazor, auth, fakes).

## See also

- [Getting Started](./01-getting-started.md)
- [Testing helpers](./10-testing-helpers.md)
- [Architecture rules](./20-architecture-rules.md)
- [Client contract tests](./30-client-contracts.md)
- [Blazor testing](./40-blazor-testing.md)
- [Changelog](./90-changelog.md)
