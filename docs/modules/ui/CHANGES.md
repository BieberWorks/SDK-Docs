# Changelog

## v0.10.0 (2026-06-24)

### Added
- `ICookieRegistrationSource` interface in `BieberWorks.SDK.UI.Contracts.Cookies`. Modules implement this to contribute cookie registrations without tight coupling to any options type. Register via `services.TryAddEnumerable(ServiceDescriptor.Singleton<ICookieRegistrationSource, T>())`.

### Changed
- `CookieConsentService` constructor now accepts `IEnumerable<ICookieRegistrationSource>` instead of `IEnumerable<CookieRegistration>`. Registrations are resolved lazily at construction time, deduplicated by name (`DistinctBy(r => r.Name)`).

### Deprecated
- `CookieConsentServiceCollectionExtensions.RegisterCookies()` is marked `[Obsolete]`. Migrate to `ICookieRegistrationSource`. Will be removed in the next major release.

## v0.3.0 (2026-06-18)

### Added
- English documentation added to module repository
