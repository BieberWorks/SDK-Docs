# Clients

`IJobQueryClient` and `IJobCommandClient` (package `BieberWorks.SDK.Jobs.Client`) are the transport-agnostic
client contract used by the Presentation ViewModels. Two implementations exist and return identical results.

All methods return `Result` / `Result<T>`. Expected failures are values, not exceptions; only cancellation and
programming errors throw.

| Method | Permission | Failure codes |
|---|---|---|
| `GetDefinitionsAsync` | `jobs:view` | `Client.Forbidden`, `Client.Unauthenticated` |
| `GetExecutionsAsync` | `jobs:view` | as above |
| `GetExecutionDetailAsync` | `jobs:view` | `Jobs.ExecutionNotFound` (missing or not visible) |
| `RetryAsync` | `jobs:retry` | `Jobs.DefinitionNotFound`, `Jobs.OwnershipMismatch` |
| `CancelAsync` | `jobs:cancel` | `Jobs.DefinitionNotFound`, `Jobs.OwnershipMismatch` |

## HTTP (Blazor WASM / remote)

```csharp
services.AddBieberWorksJobsClient(o => o.BaseAddress = "https://api.example.com/");
```

`HttpJobsClient` derives from `BwHttpClientBase` and is registered through `AddBwHttpClient`; the returned
`IHttpClientBuilder` allows chaining handlers. An `IErrorLocalizer` must be registered. The endpoints answer
with ProblemDetails carrying a `code` extension, which becomes the `DomainError` code.

## In-process (server)

`JobsModule` registers `InProcJobsClient` (an `InProcClientBase`) as `IJobQueryClient` / `IJobCommandClient`
(`TryAdd`, so a host can override). It checks the same permission keys as the endpoints and dispatches through
the app message dispatcher to handlers wrapping `IJobQueryService` / `IJobScheduler`. The ownership guard reads
the caller from `ICurrentPrincipalAccessor`, so it works outside an HTTP request (Blazor circuits).
