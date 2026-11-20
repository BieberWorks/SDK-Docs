# Client contract tests (`BieberWorks.SDK.Testing.ClientContracts`)

A module client has two transports: in-process (`InProcClientBase`) and HTTP (`BwHttpClientBase`). Both must
return the same `Result` for the same call. `ClientContractTests<TClient>` is the fixture scaffold that runs one
scenario over both and compares the outcomes. The package depends on `Testing` and `Core.Client` only; there is
**no xunit or Shouldly dependency**, so test attributes live in your own test class.

## Types

| Type | Purpose |
|---|---|
| `TransportKind` | `InProc`, `Http`. |
| `TransportKinds` | `All` and `Data` (`IEnumerable<object[]>`, one row per transport) for `[MemberData]`. |
| `ClientOutcome` | Success, or error type + code of the first error. `Ok`, `Failed(type, code)`, `From(Result)`. |
| `TransportComparison` | Outcomes (and success values) per transport; `IsMatch`, `Mismatch` (readable text). |
| `ClientContractTests<TClient>` | Abstract fixture: `CreateAsync`, `Own`, `RunAsync`, `CompareAsync`, `AssertSameAsync`. |
| `ClientContractViolationException` | Thrown by `AssertSameAsync` on a mismatch. |

## Usage

```csharp
public sealed class WalletClientContractTests : ClientContractTests<IWalletClient>
{
    private readonly BwTestHost _host = ...;   // register with Own(...) to dispose it

    public static IEnumerable<object[]> Transports => TransportKinds.Data;

    protected override Task<IWalletClient> CreateAsync(TransportKind kind, TestCurrentUser user)
    {
        if (kind == TransportKind.InProc)
        {
            var scope = Own(_host.CreateScope(user));
            return Task.FromResult<IWalletClient>(scope.ServiceProvider.GetRequiredService<InProcWalletClient>());
        }
        var http = _host.CreateClient(user);
        return Task.FromResult<IWalletClient>(
            new HttpWalletClient(http, FakeLocalizers.Error(), NullLogger<HttpWalletClient>.Instance));
    }

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

`AssertSameAsync` throws `ClientContractViolationException` with a message such as:

```
Client contract violated, outcomes differ in scenario 'get missing widget' as user 7f.. [permissions: widgets:read]:
  InProc: Failure(NotFound, Widgets.NotFound)
  Http  : Failure(NotFound, Widgets.Missing)
```

Standard scenarios for every client: success, NotFound, Forbidden (user without permission), Unauthenticated
(`TestCurrentUser.Anonymous`) and Validation.

## Notes

- Put the `MemberData` source on your own test class. Pointing `MemberType` at `TransportKinds` from another
  assembly makes the xunit analyzer `MemberDataShouldReferenceValidMember` throw AD0001 (a warning) in current versions.
- Success values are compared with `Equals`; use records for DTOs.
- Messages and `RetryAfter` are not compared, only success, error type and error code.
