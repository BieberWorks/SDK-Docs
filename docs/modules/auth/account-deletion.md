# Account Deletion

The Auth module provides two entry points for deleting a user account: **self-service** (the account owner deletes their own account) and **admin-initiated** (an administrator deletes any account). Both paths converge on the same internal `DeleteUserCommand` handler, which enforces a fixed sequence of safety guards before the identity record is removed.

Permanent data erasure across other modules is handled by SDK-Legal, which subscribes to the `UserAccountDeletionRequestedEvent` published by this module. See the SharedKernel GDPR contracts (`IUserDataErasureImpactProvider`, `UserAccountDeletionRequestedEvent`, `ErasureMode`) for the cross-module contract.

---

## Self-Service Deletion

### Route

`/account/delete` — registered as an `IAccountPage`, visible in the account shell navigation.

### Flow

1. The page loads and resolves the current user's ID from the `AuthenticationStateProvider`.
2. After first render, `IAccountDeletionPreviewService.GetPreviewAsync` is called to collect impact information from all registered modules (see [Impact Gate](#impact-gate) below). The result is displayed to the user before any confirmation is required.
3. The submit button is only enabled when **all** of the following are true:
   - The user has typed the localised confirmation word (`DeleteAccount_ConfirmWord`).
   - A non-empty password has been entered.
   - No impact gate blockers are present.
   - No deletion or preview load is already in progress.
4. On submit, `IUserManagementService.DeleteSelfAsync(userId, password)` is called.
5. On success the user is redirected to `/auth/logout` (force-load), which terminates the session immediately.
6. On failure the error code is mapped to a localised message:

| Error code | Meaning |
|---|---|
| `Identity.User.LastAdmin` | The account is the sole remaining Admin — deletion is refused. |
| `Identity.User.InvalidPassword` | The supplied password did not match. |
| `Identity.User.DeletionBlocked` | At least one impact provider returned a Blocker item. |

### Service Contract

```csharp
// BieberWorks.SDK.Auth.Contracts.IUserManagementService
Task<Result> DeleteSelfAsync(string userId, string password, CancellationToken ct = default);
```

`Result` carries typed `DomainError` codes listed above. The `Result` type is from `BieberWorks.SDK.SharedKernel.Results`.

---

## Admin-Initiated Deletion

### UI entry point

`/admin/users/{id}` — the `UserDetailPage` contains a delete button. Clicking it calls `OpenDeleteDialogAsync()` in `UserDetailBase`, which loads the erasure preview first. The delete is only confirmed when no blockers are present (`ConfirmDeleteWithBlockerCheckAsync`).

### REST endpoint

```
DELETE /api/admin/users/{userId}
```

- Requires permission `AuthPermissions.UsersManage` (constant `"users:manage"`).
- The acting user's ID is taken from the request's identity claim (`ClaimTypes.NameIdentifier`).
- Returns `204 No Content` on success, `404` when the user is not found.

### Service Contract

```csharp
// BieberWorks.SDK.Auth.Contracts.IUserManagementService
Task DeleteUserAsync(
    string userId,
    string actorUserId,
    ErasureMode mode = ErasureMode.HardDelete,
    CancellationToken ct = default);
```

`DeleteUserAsync` throws on failure (the caller maps exceptions to HTTP problem details). The admin path does **not** require a password — reauth is skipped because only users with `UsersManage` permission can reach the endpoint.

---

## DeleteUserCommandHandler — Step-by-Step

Both service methods ultimately dispatch a `DeleteUserCommand` to `DeleteUserCommandHandler`. The handler executes the following steps in order; any failure aborts the sequence.

### a. NotFound guard

`UserManager<ApplicationUser>.FindByIdAsync` is called. If the user does not exist, the handler returns `DomainError.NotFound("Identity.User.NotFound")`.

### b. Last-admin guard

If the target user holds the `Admin` role, `UserManager.GetUsersInRoleAsync("Admin")` is called. When exactly one admin exists the deletion is refused with `DomainError.Failure("Identity.User.LastAdmin")`. This prevents the system from being left without any administrator.

### c. Self-service reauth

This step runs **only** when `ActorUserId == UserId` (the account owner deletes their own account).

- If `Password` is `null` or empty → `DomainError.Validation("Identity.User.InvalidPassword")`.
- `UserManager.CheckPasswordAsync(user, password)` is called. On failure → `DomainError.Validation("Identity.User.InvalidPassword")`.

The admin path (`ActorUserId != UserId`) bypasses this step entirely.

### d. Impact gate

`IEnumerable<IUserDataErasureImpactProvider>` is iterated. Each provider's `GetImpactAsync(userId, ct)` is awaited individually:

- If a provider throws, the exception is caught and treated as a `Blocker` item — **fail-safe** behavior to prevent unintended deletion when a module cannot report its state.
- All collected `UserErasureImpact` results are flattened and filtered for items with `ErasureImpactSeverity.Blocker`.
- When at least one blocker is present, the handler returns `DomainError.Failure("Identity.User.DeletionBlocked", <concatenated blocker messages>)`.

Modules register an `IUserDataErasureImpactProvider` implementation to participate in this gate (defined in `BieberWorks.SDK.SharedKernel`).

### e. Delete and publish event

`UserManager.DeleteAsync(user)` is called. On Identity failure the handler returns `DomainError.Validation("Identity.User.DeleteFailed", <identity errors>)`.

On success a `UserAccountDeletionRequestedEvent(userId, actorUserId, mode)` is attached to the `Result` as a domain event. The infrastructure publishes the event after the command completes; SDK-Legal's event handler performs the actual cross-module data erasure.

---

## Erasure Preview

### `IAccountDeletionPreviewService`

```csharp
// BieberWorks.SDK.Auth.Contracts
public interface IAccountDeletionPreviewService
{
    Task<AccountDeletionPreviewResult> GetPreviewAsync(
        string userId, CancellationToken ct = default);
}
```

Aggregates results from all registered `IUserDataErasureImpactProvider` implementations. Provider exceptions are caught and represented as Blocker items (same fail-safe policy as the handler).

### `AccountDeletionPreviewResult`

```csharp
public sealed record AccountDeletionPreviewResult(IReadOnlyList<UserErasureImpact> Impacts)
{
    bool HasBlockers { get; }                    // true when any item has severity Blocker
    IReadOnlyList<string> BlockerMessages { get; }
    IReadOnlyList<string> WarningMessages { get; }
}
```

Both the self-service page (`DeleteAccountBase`) and the admin detail page (`UserDetailBase`) call `GetPreviewAsync` and surface the result to the user before the confirmation dialog is shown.

---

## Cross-Module Wiring

| Concern | Owner |
|---|---|
| Identity record removal | `SDK-Auth` (`DeleteUserCommandHandler`) |
| Last-admin guard | `SDK-Auth` |
| Password reauth (self-service) | `SDK-Auth` |
| Impact gate contract (`IUserDataErasureImpactProvider`) | `BieberWorks.SDK.SharedKernel` |
| Cross-module data erasure | `SDK-Legal` (subscribes to `UserAccountDeletionRequestedEvent`) |
| GDPR erasure request tracking | `SDK-Legal` |

Modules that hold user data implement `IUserDataErasureImpactProvider` and register it in their DI composition root. Auth does not depend on those modules at compile time; the providers are resolved via `IEnumerable<IUserDataErasureImpactProvider>` at runtime.
