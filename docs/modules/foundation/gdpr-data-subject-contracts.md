# GDPR Data-Subject Contracts

`BieberWorks.SDK.SharedKernel` defines the cross-module contracts that allow an orchestrator — SDK-Legal — to perform data-subject export and erasure across all installed modules without taking a direct dependency on any of them.

Every module that holds personal data implements one or more of these interfaces and registers them via `TryAddEnumerable`. SDK-Legal discovers all registered implementations at runtime and calls them in sequence.

## Overview

| Contract | Purpose |
|---|---|
| `IUserDataExporter` | Export all personal data for a user (GDPR Art. 20 portability) |
| `IUserDataEraser` | Delete or anonymise personal data (GDPR Art. 17 erasure) |
| `IUserDataErasureImpactProvider` | Report consequences before erasure is carried out |
| `UserAccountDeletionRequestedEvent` | Domain event that triggers the erasure saga |

---

## IUserDataExporter

```csharp
namespace BieberWorks.SDK.SharedKernel;

public interface IUserDataExporter
{
    /// <summary>Stable identifier matching the module's IModule.Name.</summary>
    string ModuleName { get; }

    /// <summary>
    /// Returns all personal data held by this module for userId as a JSON string.
    /// </summary>
    Task<UserDataExport> ExportAsync(string userId, CancellationToken ct = default);
}

public sealed record UserDataExport(string ModuleName, string Json);
```

`ExportAsync` must return a serialised JSON object whose shape is defined by the module. The orchestrator aggregates all `UserDataExport` payloads into a single archive.

---

## IUserDataEraser

```csharp
namespace BieberWorks.SDK.SharedKernel;

public interface IUserDataEraser
{
    string ModuleName { get; }

    Task<UserErasureResult> EraseAsync(
        string            userId,
        ErasureMode       mode,
        CancellationToken ct = default);
}

public sealed record UserErasureResult(
    string  ModuleName,
    int     Affected,
    int     Retained,
    string? RetainedReason);
```

### ErasureMode

```csharp
public enum ErasureMode
{
    /// <summary>Physically delete all personal data for the user.</summary>
    HardDelete,

    /// <summary>
    /// Replace identifying fields with a non-reversible tombstone value.
    /// Use when legal retention obligations prevent physical deletion.
    /// </summary>
    Anonymize
}
```

### Semantics

- **`HardDelete`** — rows are physically removed from the database. Use this as the default unless a retention obligation applies.
- **`Anonymize`** — identifying columns (name, email, IP, …) are overwritten with a fixed tombstone value (e.g. `"[deleted]"`, `"0.0.0.0"`). The row itself is preserved for audit or financial reasons.

### UserErasureResult fields

| Field | Description |
|---|---|
| `Affected` | Number of records deleted or anonymised |
| `Retained` | Number of records kept unchanged due to a retention obligation |
| `RetainedReason` | Human-readable explanation; `null` when `Retained == 0` |

`EraseAsync` **must be idempotent**: calling it a second time on already-erased data must return the same result without side effects.

Each module must operate within its own `DbContext` transaction only. Cross-module transaction coordination is the orchestrator's responsibility.

---

## IUserDataErasureImpactProvider

```csharp
namespace BieberWorks.SDK.SharedKernel;

public interface IUserDataErasureImpactProvider
{
    string ModuleName { get; }

    /// <summary>
    /// Returns the impact of deleting userId, or null when this module has nothing to report.
    /// This method must be idempotent and read-only — it must not modify any state.
    /// Messages should be localised by the implementing module.
    /// </summary>
    Task<UserErasureImpact?> GetImpactAsync(string userId, CancellationToken ct = default);
}

public sealed record UserErasureImpact(
    string ModuleName,
    IReadOnlyList<ErasureImpactItem> Items);

public sealed record ErasureImpactItem(string Message, ErasureImpactSeverity Severity);

public enum ErasureImpactSeverity
{
    /// <summary>Informational — the user is warned, deletion proceeds.</summary>
    Warning = 0,

    /// <summary>Hard stop — deletion is refused until the condition is resolved.</summary>
    Blocker = 1,
}
```

### Severity semantics

| Severity | Behaviour |
|---|---|
| `Warning` | The orchestrator shows the message to the admin / user; deletion still proceeds |
| `Blocker` | The orchestrator refuses deletion until the reported condition is resolved |

Return `null` (not an empty `UserErasureImpact`) when the module has no data or no concern for this user. The orchestrator skips `null` returns silently.

`GetImpactAsync` is **read-only**: it must not modify any state.

---

## UserAccountDeletionRequestedEvent

```csharp
namespace BieberWorks.SDK.SharedKernel;

public sealed record UserAccountDeletionRequestedEvent(
    string      TargetUserId,
    string?     ActorUserId,
    ErasureMode Mode = ErasureMode.HardDelete)
    : IAuditableEvent;
```

Published by SDK-Auth when an account deletion is initiated — either by the user themselves (self-service) or by an administrator. SDK-Legal listens for this event to trigger the GDPR erasure saga.

| Parameter | Description |
|---|---|
| `TargetUserId` | The user whose data is to be erased |
| `ActorUserId` | The user who initiated the deletion; `null` for system-initiated events |
| `Mode` | `HardDelete` (default) or `Anonymize` |

Because `UserAccountDeletionRequestedEvent` implements `IAuditableEvent`, SDK-Audit logs it automatically without any additional code in SDK-Auth or SDK-Legal.

---

## Registration Pattern

All three interfaces use `TryAddEnumerable` to allow multiple implementations to coexist. Register your implementation in your module's `*Module.cs`:

```csharp
// In RegisterCommandHandlers() or a dedicated RegisterGdprServices() method:
services.TryAddEnumerable(
    ServiceDescriptor.Scoped<IUserDataExporter, WalletDataExporter>());

services.TryAddEnumerable(
    ServiceDescriptor.Scoped<IUserDataEraser, WalletDataEraser>());

services.TryAddEnumerable(
    ServiceDescriptor.Scoped<IUserDataErasureImpactProvider, WalletErasureImpactProvider>());
```

Using `AddScoped` instead of `TryAddEnumerable` would replace earlier registrations and break modules that register the same interface.

---

## Implementation Example

The following skeleton is representative of SDK-Audit or SDK-Wallet:

```csharp
internal sealed class WalletDataEraser(WalletDbContext db) : IUserDataEraser
{
    public string ModuleName => "SDK-Wallet";

    public async Task<UserErasureResult> EraseAsync(
        string userId, ErasureMode mode, CancellationToken ct = default)
    {
        var wallets = await db.Wallets
            .Where(w => w.OwnerId == userId)
            .ToListAsync(ct);

        if (wallets.Count == 0)
            return new UserErasureResult(ModuleName, 0, 0, null);

        int retained = 0;
        string? retainedReason = null;

        foreach (var wallet in wallets)
        {
            if (wallet.Balance > 0)
            {
                // Retain rows with open balances — financial retention obligation.
                retained++;
                retainedReason = "Open balance — retained for financial records.";
            }
            else if (mode == ErasureMode.HardDelete)
            {
                db.Wallets.Remove(wallet);
            }
            else
            {
                wallet.OwnerId = "[deleted]";
            }
        }

        await db.SaveChangesAsync(ct);

        return new UserErasureResult(
            ModuleName,
            Affected: wallets.Count - retained,
            Retained: retained,
            RetainedReason: retainedReason);
    }
}
```

---

## Relationship Between Contracts

```
UserAccountDeletionRequestedEvent
  └── SDK-Legal (orchestrator)
        ├── IUserDataErasureImpactProvider  (read-only pre-check)
        │     Blocker found? → refuse deletion
        │     Warnings only? → show & proceed
        ├── IUserDataEraser                 (write: delete / anonymise)
        └── IUserDataExporter               (read: build data-export archive)
```

The orchestrator calls `IUserDataErasureImpactProvider` first. If any module returns a `Blocker` item, deletion stops. Otherwise it calls `IUserDataEraser` across all modules. `IUserDataExporter` is called independently as part of a separate data-export flow (GDPR Art. 20) and is not part of the deletion path.
