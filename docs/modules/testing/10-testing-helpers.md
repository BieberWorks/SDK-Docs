# Testing helpers

## InMemoryDb

```csharp
IDbContextFactory<MyDbContext> factory = InMemoryDb.CreateFactory<MyDbContext>();
MyDbContext ctx = InMemoryDb.CreateContext<MyDbContext>();
```

Every call without an explicit name gets a unique database. `TransactionIgnoredWarning` is
suppressed. EF InMemory does not enforce relational constraints or schemas; use Postgres for those.

## TestCurrentUser

`TestCurrentUser.Admin()`, `.WithPermissions("a", "b")` and `TestCurrentUser.Anonymous` expose a
`ClaimsPrincipal` using the claim types of the Foundation permission service (`NameIdentifier`/`sub`,
`perm`, `role`). The wildcard permission `*` grants everything in the catalog.

## TestAuthHandler

Authentication scheme `Test`. Headers `X-Test-User` (user id), `X-Test-Permissions` and
`X-Test-Roles` (comma separated); without `X-Test-User` the request is anonymous.

## FakeLocalizers

`FakeLocalizers.Error()` returns an `IErrorLocalizer` that returns the error code;
`FakeLocalizers.Strings<T>()` returns an `IStringLocalizer<T>` that returns the key.

## BwTestHost

```csharp
await using var host = BwTestHost.Create(typeof(MyModule).Assembly);
var client = host.CreateClient(TestCurrentUser.WithPermissions("my:read"));
```

Builds a `WebApplication` on `TestServer`, registers modules from the given assemblies, swaps every
registered `DbContext` options registration to EF InMemory, makes `Test` the default authentication
scheme and maps module endpoints. Pooled context factories are not swapped.
