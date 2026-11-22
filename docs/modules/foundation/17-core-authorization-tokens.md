# Core.Authorization: delegated access tokens (scopes and clients)

`BieberWorks.SDK.Core.Authorization` ships two authorization requirements for resource servers that must only accept delegated OAuth 2.0 access tokens (for example admin APIs that are called by an admin tool signed in through OpenID Connect). They live next to `PermissionRequirement` and need no DI registration beyond `AddAuthorization()`: each requirement handles itself.

```csharp
using BieberWorks.SDK.Core.Authorization;

group.RequireAuthorization(policy =>
{
    policy.RequireScope("perm");                 // all listed scopes must be present
    if (allowedClients.Count > 0)
    {
        policy.RequireClient(allowedClients);    // token must be issued to one of these clients
    }
});
```

## Reading the token

| Source | Claim types | Notes |
|---|---|---|
| Scopes | `scope`, `scp` | Space-delimited string or several claims; all values are unioned |
| Scopes | `oi_scp` | OpenIddict-internal, one scope per claim (neither split nor trimmed) |
| Client | `client_id`, otherwise `azp` | If both are present and differ, or a type has several different values, the client is unknown. A blank `client_id` (or `azp`) also makes it unknown; it never falls back to the other claim |

- Only claims of authenticated identities (`IsAuthenticated == true`) are read, across all identities of the principal. An unauthenticated additional identity cannot contribute a scope or client id.
- Scopes are split at the space character only. There is no trimming: a tab, a non-breaking space or surrounding whitespace in an `oi_scp` value yields a different, non-matching scope (fail closed).
- Comparisons are ordinal and case-sensitive (RFC 6749). `PERM` does not satisfy `perm`; `permission` does not satisfy `perm`.
- A principal without any scope claim (cookie session, plain login token, service token) never satisfies `RequireScope`, even when it carries the right permissions or roles.
- `RequireClient` fails when the client id cannot be determined. An empty allowlist, or an entry that is blank or has leading or trailing whitespace, throws `ArgumentException` at construction (`AllowedClients` is an immutable set): the caller adds the requirement only when a list is configured, and decides what an empty list means (for example "open, with a startup warning").
- On failure the policy answers 403 without a body, like a missing permission. Failure reasons and `ToString()` never contain token values.
- Allowlists are usually read once when the endpoints are mapped, so changing them requires a restart.

`TokenClaims.GetScopes(ClaimsPrincipal)` and `TokenClaims.GetClientId(ClaimsPrincipal)` are public if you need the same reading outside a policy.
