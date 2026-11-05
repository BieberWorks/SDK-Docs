# Client Pattern

A module exposes its capabilities to other code through a client interface in `*.Contracts` (for example `INotificationsClient`). The interface has two transports that return **identical** results:

| Transport | Class | Base class | Package |
|---|---|---|---|
| In-process | `InProc<Module>Client` | `InProcClientBase` | `Core.Authorization` (namespace `BieberWorks.SDK.Core.Clients`) |
| HTTP | `Http<Module>Client` | `BwHttpClientBase` | `Core.Client` (no ASP.NET dependency, WASM-capable) |

Calling code depends only on the interface and does not care which transport is registered.

## Which transport per host type

| Host type | Transport | Reason |
|---|---|---|
| Monolith Blazor Server (module runs in the same process) | InProc | No network hop; the caller is resolved from the circuit or request. |
| Separate frontend (Blazor Server / SSR / BFF) talking to a module backend | Http + [auth forwarding](#auth-forwarding) | The module runs in another process. |
| Blazor WebAssembly | Http | Code runs in the browser and cannot reach the server process. |
| MAUI Hybrid | Http, or InProc when the module is embedded in the app process | The principal comes from `AuthenticationStateProvider`. |

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

`ICurrentPrincipalAccessor` (`Core.Authorization`) yields the caller's `ClaimsPrincipal` independent of the transport. `Core.Web` ships an HTTP-context accessor, an `AuthenticationStateProvider` accessor (Blazor circuits, MAUI Hybrid) and the default composite, which prefers an authenticated `AuthenticationStateProvider` state and otherwise falls back to the HTTP context. Register it with `services.AddBieberWorksPrincipalAccessor()`.

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

`AddBwHttpClient` returns the `IHttpClientBuilder`, so handlers (auth forwarding, resilience) can be chained. Request paths must be relative. A 204 or empty body yields a successful `Result<T>` with `default` value. Register an `IErrorLocalizer` in WASM hosts.

## Result instead of exceptions

Clients return failures as `Result` / `Result<T>` values. Only cancellation and programming errors (for example `null` arguments) throw. Callers inspect the result and branch on the error type and code instead of catching exceptions.

## Error mapping

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

If the response is `application/*json` ProblemDetails with a string `code` extension member, that code replaces the default code; the type is always derived from the status. `Retry-After` (delta or date) is exposed as `DomainError.RetryAfter`. The default codes have localized texts (English and German) resolved through `IErrorLocalizer`.

::: warning Servers must return ProblemDetails with a code
For both transports to match, module endpoints must answer failures with ProblemDetails that carries the stable domain code in a `code` extension (for example `Notifications.NotFound`). Without it the HTTP client falls back to the generic `Client.*` code and the contract tests fail.
:::

## Contract tests

Both transports must return the same `Result` for the same call. Prove it with `BieberWorks.SDK.Testing.ClientContracts` (`ClientContractTests<TClient>`, `AssertSameAsync`); the module template generates this test when you pass `--WithClient`. Details, including the required `Transports => TransportKinds.Data` member on your own test class, are in [Testing Conventions](/guide/testing-conventions#contract-tests).

## Auth forwarding

A separate frontend that calls a protected backend on behalf of the signed-in user chains `AddAuthForwarding()` onto the client's builder:

```csharp
builder.Services.AddBieberWorksAuthForwarding();     // Blazor Server / SSR host (Auth.Client.Server)

services.AddBwHttpClient<INotesClient, HttpNotesClient>("https://api.example.com/")
        .AddAuthForwarding();
```

- **Cookie vs bearer:** the `bw.auth` cookie is forwarded by default (same-site setups); for cross-site setups implement `IAuthForwardingSource` returning `AuthForwardCredential.Bearer(token)`.
- **Data Protection caveat:** the auth cookie is an encrypted Data Protection ticket. Forwarding only works when the API validates the cookie itself (same auth backend, or a shared key ring and the same `ApplicationName`). If the key ring cannot be shared, use a bearer token.
- Credentials are attached only to exactly matching origins over HTTPS, redirects are not followed, and a `401` is not retried.

Full setup, circuit behaviour (`<BwAuthForwardCapture />`) and the security rules are on the Auth module page: [Auth Forwarding](/modules/auth/15-auth-forwarding).

## Migration example: Notifications 3.0

`SDK-Notifications` 3.0.0 moved onto this pattern and is the reference migration (see the [Notifications module](/modules/notifications/)):

- `INotificationsClient` methods return `Result` / `Result<T>`.
- The in-process client uses `ICurrentPrincipalAccessor` instead of `IHttpContextAccessor`.
- `HttpNotificationsClient` takes `(HttpClient, IErrorLocalizer, ILogger<HttpNotificationsClient>)` and is registered through `AddBwHttpClient` by `AddBieberWorksNotificationsClient`.
- HTTP endpoints answer failures with ProblemDetails carrying `code`.
- `NotificationsClientContractTests` verifies that both transports agree.

Code that mocks `INotificationsClient` must now return `Result` values.
