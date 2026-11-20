# Getting Started

Add the packages to test projects only (never to production projects):

```xml
<PackageReference Include="BieberWorks.SDK.Testing" Version="0.*-*" />
<PackageReference Include="BieberWorks.SDK.Testing.Architecture" Version="0.*-*" />
<PackageReference Include="BieberWorks.SDK.Testing.ClientContracts" Version="0.*-*" />
<PackageReference Include="BieberWorks.SDK.Testing.Blazor" Version="0.*-*" />
```

The test project keeps its own `xunit.v3` and `Shouldly` references.
