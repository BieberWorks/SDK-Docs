# Subscriptions (Phase 2)

## Status: Reserved Seam, Not Implemented

`ISubscriptionProvider` (namespace `BieberWorks.SDK.Payments.Contracts`) is an intentionally empty
interface that reserves the contract shape for future Stripe Billing / recurring-subscription
support:

```csharp
public interface ISubscriptionProvider
{
}
```

- No members are defined yet.
- No implementation is registered in `PaymentsModule`.
- Its purpose is purely to let the interface's *shape* exist now, so that adding subscription
  support later is additive/non-breaking and does not require a new major package version for the
  contract itself.

## Do Not

Do not add members to `ISubscriptionProvider` or start implementing it without first updating the
Payments module's implementation plan — this is a deliberate placeholder, not a partially built
feature.

## Further Reading

- [Module Overview & Packages](index.md)
- [Stripe Flow](11-stripe-flow.md)
