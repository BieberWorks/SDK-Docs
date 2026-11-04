# SDK-Testing

Shared test infrastructure for SDK modules. Neither package pulls in xunit or Shouldly
transitively; consumers keep their own test-framework references.

## Packages

- `BieberWorks.SDK.Testing` - `InMemoryDb`, `TestCurrentUser`, `TestAuthHandler`, `FakeLocalizers`, `BwTestHost`.
- `BieberWorks.SDK.Testing.Architecture` - `ModuleGraph` + `ArchitectureRules`, based on assembly metadata only.

## See also

- [Getting Started](./01-getting-started.md)
- [Testing helpers](./10-testing-helpers.md)
- [Architecture rules](./20-architecture-rules.md)
- [Changelog](./90-changelog.md)
