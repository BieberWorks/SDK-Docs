# NuGet Access

All BieberWorks SDK packages are published to GitHub Packages under the `BieberWorks` organization. They are not on nuget.org. Access requires a GitHub account with `read:packages` permission in the `BieberWorks` org and a Personal Access Token (PAT) with the `read:packages` scope.

## nuget.config Template

Create a `nuget.config` file in your solution root:

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <clear />
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" protocolVersion="3" />
    <add key="bieberworks" value="https://nuget.pkg.github.com/BieberWorks/index.json" />
  </packageSources>
  <packageSourceCredentials>
    <bieberworks>
      <add key="Username" value="GITHUB_USER" />
      <add key="ClearTextPassword" value="PACKAGES_TOKEN" />
    </bieberworks>
  </packageSourceCredentials>
</configuration>
```

Replace `GITHUB_USER` with your GitHub username. `PACKAGES_TOKEN` is a placeholder — replace it with your actual PAT or (better) read it from an environment variable as described below.

::: warning Do not commit the token
Never check a real PAT into source control. The `nuget.config` with the literal placeholder string is safe to commit — the actual token must come from outside.
:::

## Setting the Token Locally (Developer Machine)

Set the token as an environment variable that NuGet resolves automatically:

```powershell
# PowerShell — set for the current session
$env:PACKAGES_TOKEN = "ghp_yourTokenHere"
```

Or use `%PACKAGES_TOKEN%` directly in `nuget.config` (NuGet on Windows expands `%VAR%` in credential values):

```xml
<add key="ClearTextPassword" value="%PACKAGES_TOKEN%" />
```

## Setting the Token in CI/CD (GitHub Actions)

Store the token as a repository or organization secret, then pass it to the workflow:

```yaml
- name: Restore NuGet packages
  run: dotnet restore
  env:
    PACKAGES_TOKEN: ${{ secrets.PACKAGES_TOKEN }}
```

::: tip Setting secrets via gh CLI
Use `--body`, not stdin — stdin adds a trailing `\r\n` which makes the token invalid:

```powershell
# Correct
gh secret set PACKAGES_TOKEN --body "ghp_yourTokenHere" --repo BieberWorks/MyRepo
```
:::

## Required PAT Scope

| Scope | Required for |
|---|---|
| `read:packages` | Restoring packages from GitHub Packages |
| `write:packages` | Publishing packages (CI only — not needed for consumers) |

## Local Development Feed (SDK Contributors Only)

If you are developing the SDK modules themselves, use the local feed to test unpublished changes:

```xml
<packageSources>
  <add key="nuget.org" value="https://api.nuget.org/v3/index.json" protocolVersion="3" />
  <add key="bieberworks-local" value="..\local-nuget-feed" />
</packageSources>
```

Pack a module to the local feed:

```powershell
dotnet pack SDK-Foundation\SDK-Foundation.slnx -c Release -p:Version=0.7.1-sdkdev -o ..\local-nuget-feed
```

Then restore in the consumer:

```powershell
dotnet nuget locals all --clear
dotnet restore --force-evaluate
```

::: warning Clear the NuGet cache after re-packing
If you pack a new version with the same version string, the global NuGet HTTP cache may serve the old package. Always run `nuget locals all --clear` before restoring with updated local packages.
:::
