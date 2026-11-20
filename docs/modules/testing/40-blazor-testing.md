# Blazor testing (`BieberWorks.SDK.Testing.Blazor`)

`BwBunitContext` is a bUnit 2.x `BunitContext` preconfigured for SDK UI components (MudBlazor 9). Derive your test
class from it instead of repeating the setup in every test project.

```csharp
public sealed class AccountLayoutTests : BwBunitContext
{
    public AccountLayoutTests() : base(TestCurrentUser.WithPermissions("account:read")) { }

    [Fact]
    public void Renders_body()
    {
        RenderMudProviders();                       // popover, dialog, snackbar providers
        var cut = Render<AccountLayout>(p => p.Add(c => c.Body, ...));
        cut.FindAll("#body").Count.ShouldBe(1);
    }
}
```

## What the context registers

| Registration | Detail |
|---|---|
| MudBlazor | `AddMudServices()`, `AddLocalization()`. |
| JSInterop | `JSRuntimeMode.Loose`. |
| `ILayoutThemeContext` | `FakeLayoutThemeContext` (exposed as `LayoutTheme`; records the key, raises `OnChanged`). |
| `IThemeModeService` | `FakeThemeModeService` (`ThemeMode`; toggle flips `IsDarkMode`). |
| `IShellIconResolver` | `PassthroughIconResolver` (token returned unchanged). |
| Authorization | bUnit `AddAuthorization()` as `Authorization`; `SetUser(TestCurrentUser)` sets the authorized state, claims, roles and the policies `perm:<permission>`. Default user is `TestCurrentUser.Admin()`; the anonymous user is denied. |
| Localizers | `IErrorLocalizer` returns the error code; open generic `IStringLocalizer<>` returns the key. |
| `ICurrentPrincipalAccessor` | `TestPrincipalAccessor`, following `User`. |

## UI rules

- `BwThemeProvider` is never rendered by the context: it exists exactly once, in the host's `Routes.razor`.
  Layouts and components under test call `ILayoutThemeContext.Set()` and are verified through `LayoutTheme`.
- `UI.Contracts` stays MudBlazor-free; this package is the only place that combines the test fakes with MudBlazor types.
- Module-specific services (for example a module's own `IShellNavigationService<T>`) are registered in the test via `Services`.

## Replaces

The repeated setup in `Account.UI.MudBlazor.Tests` and `Admin.UI.MudBlazor.Tests`
(`AddMudServices`, `AddLocalization`, loose JSInterop, `Mock<ILayoutThemeContext>`, `Mock<IThemeModeService>`,
`IShellIconResolver`, `AddAuthorization().SetAuthorized(...)`).
