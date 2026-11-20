# Auth Forwarding

A decoupled web frontend (Blazor Server, SSR, BFF or WASM) often calls protected endpoints of the Auth or module backend on behalf of the signed-in user. Auth forwarding attaches the user's credential (the auth cookie or a bearer token) to those outgoing `HttpClient` requests, safely.

## Packages

| Package | Contents | Platform |
|---|---|---|
| `BieberWorks.SDK.Auth.Client` | `IAuthForwardingSource`, `AuthForwardCredential`, `AuthForwardingOptions`, `AuthForwardingHandler`, `AddAuthForwarding()` | No ASP.NET dependency, WASM-capable |
| `BieberWorks.SDK.Auth.Client.Server` | `HttpContextAuthForwardingSource`, `CircuitAuthForwardingState`, `<BwAuthForwardCapture />` (optional), `AddBieberWorksAuthForwarding()` | ASP.NET Core / Blazor Server |

## Setup (Blazor Server or SSR host)

```csharp
builder.Services.AddBieberWorksAuthForwarding();          // sources, circuit handler, 401 observer

builder.Services.AddHttpClient<IMyApiClient, MyApiClient>(c => c.BaseAddress = new Uri("https://api.example.com"))
    .AddAuthForwarding();                                  // default allowed origin = BaseAddress
```

No component is needed in `App.razor` for Blazor Server circuits (since 3.7.1). `<BwAuthForwardCapture />` still exists for compatibility but is optional; see [Blazor Server circuits](#blazor-server-circuits).

## Cookie or bearer

- **Cookie** (default for same-site setups): the incoming `bw.auth` cookie is forwarded as a `Cookie` header. The cookie name comes from `AuthForwardingOptions.CookieName`; `AddBieberWorksAuthForwarding` defaults it to the configuration key `BieberWorks:Auth:Cookie:CookieName` (the same key `AuthCookieOptions` binds), else `bw.auth`.
- **Bearer** (cross-site, or when the cookie cannot be validated by the API): implement `IAuthForwardingSource` returning `AuthForwardCredential.Bearer(token)`. An incoming `Authorization: Bearer` header is also forwarded when no cookie is present.

::: warning The auth cookie is a Data Protection ticket
The `bw.auth` cookie is an encrypted ASP.NET Core Data Protection ticket. Forwarding only works when **the API validates the cookie itself**. That requires the same auth backend, or a shared Data Protection key ring and the same `ApplicationName` on both sides, plus cookie domain scoping that lets the browser send the cookie to the frontend host (`AuthCookieOptions.Domain`, which widens exposure to all subdomains). The frontend merely passes the cookie through and does not need to decrypt it. If the key ring cannot be shared, use a bearer token.
:::

## Security rules (enforced by the handler)

- Credentials are attached **only** when the request origin (scheme, host, port) exactly equals an entry of `AllowedOrigins`. Default: the origin of the typed client's `BaseAddress`. No subdomain or suffix matching: `api.example.com.evil.tld`, another port or `http` instead of `https` all receive nothing and log a warning.
- Entries must be plain origins (`https://api.example.com`), no path.
- HTTPS is required. Plain `http` is accepted only for loopback hosts (`localhost`, `127.0.0.1`, `::1`) and only with `AllowInsecureLoopback = true` (development).
- Redirects: `AddAuthForwarding()` sets `AllowAutoRedirect = false` on the primary handler (replacing a primary handler configured earlier), so credentials never follow a `3xx`. In the browser the platform handles redirects; keep forwarding origins to API hosts that do not redirect cross-origin.
- Cookie and token values are never logged; `AuthForwardCredential.ToString()` is redacted. Values containing header-injection characters are not sent.

## Blazor Server circuits

A circuit runs in its own DI scope and has no usable `HttpContext` after it starts. A component in the static `App.razor` runs in the *request* scope, so anything it writes never reaches the circuit scope. Therefore the registered circuit handler fills the circuit-scoped `CircuitAuthForwardingState` itself, on `OnCircuitOpenedAsync` and again on every `OnConnectionUpAsync` (reconnect). It reads the credential from the `HttpContext` of the SignalR connection through `IHttpContextAccessor`. Circuit open runs before the root components render, so the state is filled before the first component initializes and before the first outgoing call. Calls run through an `AsyncLocal` bridge (the same handler), because `HttpClientFactory` handlers live in their own DI scope.

- The credential is a **snapshot** taken at circuit open and at each reconnect. A cookie renewed while the connection stays up is not seen until the next reconnect.
- On reconnect, if an `HttpContext` is present but carries no credential (sign-out), the state is cleared. If no `HttpContext` is available, the existing state is kept; nothing throws and a debug log entry is written (never containing credential values).
- `IHttpContextAccessor.HttpContext` is not guaranteed during interactive rendering. It is generally available on the WebSocket connect request; verify your transport (long polling, proxies) in your host. If it is `null`, nothing is forwarded from the circuit; supply a bearer `IAuthForwardingSource` instead.
- If the API answers a forwarded request with `401`, the credential is dropped, **no retry** happens and `CircuitAuthForwardingState.SessionExpired` is raised once. Subscribe to it to show a "session expired" notice or force a reload.
- A stale snapshot surfaces as the `401` above.
- Static SSR requests use the request's `HttpContext` directly and need no circuit state.

## Blazor WebAssembly

The browser owns the cookies. For cross-origin calls call `request.SetBrowserRequestCredentials(BrowserRequestCredentials.Include)` (from `Microsoft.AspNetCore.Components.WebAssembly`) in a small `DelegatingHandler` of your app, and enable CORS `AllowCredentials` with an explicit origin on the API. Same-origin calls need no handler. `Auth.Client` deliberately avoids the WebAssembly package dependency.

## Verifying end to end (sandbox)

Run two hosts (frontend and API) sharing a Data Protection key ring and `ApplicationName`, sign in on the frontend, call a protected API endpoint through a client registered with `.AddAuthForwarding()` and expect `200`. Then expire the session on the API and expect a `401`, exactly one `SessionExpired` event and no retry.

## Combining with the HTTP auth client and `AddBwHttpClient`

`AddAuthForwarding` extends any `IHttpClientBuilder`, so it chains onto the typed client of the Auth HTTP client
or onto a module client registered with `AddBwHttpClient` (Foundation `Core.Client`):

```csharp
// Auth's own HTTP client
services.AddHttpClient<IAuthClient, HttpAuthClient>(c => c.BaseAddress = new Uri("https://api.example.com/api/"))
        .AddAuthForwarding();

// A module client built on BwHttpClientBase
services.AddBwHttpClient<INotesClient, HttpNotesClient>("https://api.example.com/")
        .AddAuthForwarding();
```

## Client transports and error codes

`HttpAuthClient` and `InProcAuthClient` return the same `AuthResult` for the same call. Failures from the API carry
the stable error code in the response body (`code`); `HttpAuthClient` copies it into `AuthResult.ErrorCodes` and sets
`RequiresEmailConfirmation` for `Identity.Login.EmailNotConfirmed`, exactly like the in-process client.
