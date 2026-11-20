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

## TestPrincipalAccessor

`TestPrincipalAccessor` implements `ICurrentPrincipalAccessor` (Core.Authorization) and yields the
principal of its settable `User` (default `TestCurrentUser.Anonymous`). `BwTestHost` registers it as a scoped
`ICurrentPrincipalAccessor`, replacing the `Core.Web` accessors, so in-process clients see the same identity
that `TestAuthHandler` establishes for HTTP requests. `host.CreateScope(user)` returns a service scope whose
accessor yields `user`. Inside an HTTP request the accessor returns the authenticated `HttpContext.User`
(the `TestCurrentUser` sent by `CreateClient(user)`), so handlers see the same caller over the HTTP transport; with no
authenticated request it falls back to `User`, which defaults to anonymous. `BwBunitContext` is unaffected (it has its
own accessor, no HTTP). The host also registers `AddBieberWorksAuthorization()` (permission service and `perm:*`
policies) and, unless a module registers one, the key-returning `IErrorLocalizer` fake.

`KeyStringLocalizer<T>` is public, so it can be registered as an open generic
(`services.AddSingleton(typeof(IStringLocalizer<>), typeof(KeyStringLocalizer<>))`).
