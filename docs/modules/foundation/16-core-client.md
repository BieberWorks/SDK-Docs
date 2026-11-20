# Core.Client and the client pattern

`BieberWorks.SDK.Core.Client` (Tier 0) provides the HTTP half of the SDK client pattern. It has no ASP.NET dependency and works in Blazor WebAssembly. The in-process half lives in `Core.Authorization` (`InProcClientBase`). Both transports return the same `Result` / `Result<T>` values, so a module's client contract behaves identically whether it runs in-process or over HTTP.

## Error semantics

Clients return failures instead of throwing for expected conditions. Only cancellation and programming errors (for example `null` arguments) throw.

| Condition | `DomainErrorType` | Default code |
|---|---|---|
| HTTP 400 / 422 | `Validation` | `Client.Validation` |
| HTTP 401 / no principal | `Unauthorized` (unauthenticated) | `Client.Unauthenticated` |
| HTTP 403 / missing permission | `Forbidden` | `Client.Forbidden` |
| HTTP 404 | `NotFound` | `Client.NotFound` |
| HTTP 409 | `Conflict` | `Client.Conflict` |
| HTTP 429 | `TooManyRequests` (+ `RetryAfter`) | `Client.RateLimited` |
| HTTP 5xx, network error, timeout | `Unavailable` (+ `RetryAfter`) | `Client.Unavailable` |
| Unparseable success body | `Failure` | `Client.InvalidResponse` |

If the response is `application/*json` ProblemDetails with a string `code` extension member, that code replaces the default code. The type is always derived from the status. `Retry-After` (delta or date) is exposed as `DomainError.RetryAfter`. Default codes have localized texts in `ErrorResources` (English and German) and are resolved through `IErrorLocalizer`.

## HTTP client

```csharp
public sealed class HttpNotesClient(HttpClient http, IErrorLocalizer errors, ILogger<HttpNotesClient> log)
    : BwHttpClientBase(http, errors, log), INotesClient
{
    public Task<Result<NoteDto>> GetAsync(Guid id, CancellationToken ct = default)
        => GetAsync<NoteDto>($"notes/{id}", ct);

    public Task<Result> CreateAsync(CreateNote body, CancellationToken ct = default)
        => SendAsync(HttpMethod.Post, "notes", body, ct);
}

services.AddBwHttpClient<INotesClient, HttpNotesClient>("https://api.example.com/");
```

`AddBwHttpClient` returns the `IHttpClientBuilder`, so handlers (auth forwarding, resilience) can be chained. Request paths must be relative. A 204 or empty body yields a successful `Result<T>` with `default` value.

## In-process client

```csharp
internal sealed class InProcNotesClient(IAppMessageDispatcher d, ICurrentPrincipalAccessor p,
    IPermissionService s, IErrorLocalizer e, ILogger<InProcNotesClient> log)
    : InProcClientBase(d, p, s, e, log), INotesClient
{
    public Task<Result<NoteDto>> GetAsync(Guid id, CancellationToken ct = default)
        => SendAsync(new GetNote(id), "notes.read", ct);
}
```

The permission check runs before dispatch: no authenticated principal yields `Unauthenticated`, a missing permission yields `Forbidden`. Passing `null` as permission skips the check.

`InProcClientBase` is placed in the `Core.Authorization` assembly (namespace `BieberWorks.SDK.Core.Clients`) because it needs `IPermissionService`, and `Core` must stay free of ASP.NET authorization packages. `Core.Authorization` references `Core`, so there is no cycle.

## Current principal

`ICurrentPrincipalAccessor` (`Core.Authorization`) yields the caller's `ClaimsPrincipal` independent of the transport. `Core.Web` ships `HttpContextPrincipalAccessor`, `AuthenticationStateProviderPrincipalAccessor` (Blazor circuits, MAUI Hybrid) and the default `CompositePrincipalAccessor`, which prefers an authenticated `AuthenticationStateProvider` state and otherwise falls back to the HTTP context. Register with `services.AddBieberWorksPrincipalAccessor()` (idempotent; an earlier registration wins).
