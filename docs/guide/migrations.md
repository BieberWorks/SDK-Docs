# Migrations

Every BieberWorks SDK module that persists data owns its own EF Core `DbContext` and its own PostgreSQL schema. This guide covers how migrations work, how to add them, and how to handle production deployments.

## How Auto-Migration Works

`InitializeBieberWorksModulesAsync()` in `Program.cs` iterates over all `IModule` implementations that also implement `IModuleInitializer` and calls `InitializeAsync` for each in its own DI scope:

```csharp
await app.InitializeBieberWorksModulesAsync();
```

Inside each module's `InitializeAsync`, the module runs pending migrations:

```csharp
public async Task InitializeAsync(IServiceProvider serviceProvider, CancellationToken cancellationToken = default)
{
    var db = serviceProvider.GetRequiredService<MyModuleDbContext>();
    await db.Database.MigrateAsync(cancellationToken);
}
```

## Per-Schema Isolation

Each module's `__EFMigrationsHistory` table lives in its own PostgreSQL schema. Migrations across modules are fully independent.

| Module | PostgreSQL Schema | Connection string lookup order |
|---|---|---|
| Auth | `auth` | `AuthDb` → `DefaultConnection` |
| Audit | `audit` | `AuditDb` → `DefaultConnection` |
| Localization | `localization` | `LocalizationDb` → `DefaultConnection` |
| Storage | `storage` | `StorageDb` → `DefaultConnection` |
| Settings | `settings` | `SettingsDb` → `DefaultConnection` |
| Notifications | `notifications` | `NotificationsDb` → `DefaultConnection` |

All modules can share a single PostgreSQL database instance while remaining schema-isolated.

## The `--no-build` Trap

::: danger Never use --no-build
`dotnet ef migrations add --no-build` reads the DLL that was compiled last. If you made changes since the last build, the generated migration reflects the stale model — producing duplicate tables, missing columns, or wrong types.

Always run `dotnet ef` without `--no-build`.
:::

## Adding a Migration

```powershell
dotnet ef migrations add MyMigrationName `
  --project src\MyModule `
  --startup-project ..\Sandbox
```

Review the generated SQL before applying:

```powershell
dotnet ef migrations script `
  --project src\MyModule `
  --startup-project ..\Sandbox `
  --idempotent
```

Check for unexpected `DROP TABLE`, duplicate column additions, or missing schema prefixes.

## Production Deployment

### Option A: Auto-migrate on Startup (current default)

`InitializeBieberWorksModulesAsync()` runs every startup. Pending migrations are applied before the first request.

**Suitable for:** single-instance deployments.

**Not suitable for:** multiple instances starting simultaneously — they all attempt to migrate concurrently.

### Option B: Separate Migration Step in CI/CD (recommended for multi-instance)

Run migrations as a pre-deployment step:

```powershell
dotnet ef database update `
  --project src\Auth `
  --startup-project deploy\MigrationRunner

dotnet ef database update `
  --project src\Audit `
  --startup-project deploy\MigrationRunner
# repeat per module
```

Then deploy application instances. Already-migrated = no-op.

## Rollback Strategy

EF Core does not support automatic rollback. Manual rollback:

```powershell
# List available migration names
dotnet ef migrations list --project src\MyModule --startup-project ..\Sandbox

# Roll back to a specific migration
dotnet ef database update PreviousMigrationName `
  --project src\MyModule `
  --startup-project ..\Sandbox

# Remove the latest migration file from source
dotnet ef migrations remove --project src\MyModule --startup-project ..\Sandbox
```

::: tip Snapshot discipline
Tag the git commit before applying a migration on production. If rollback is needed, both the migration name and the code snapshot are recoverable via git.
:::

## Seeding Data

`InitializeAsync` is the right place for idempotent seed data:

```csharp
public async Task InitializeAsync(IServiceProvider serviceProvider, CancellationToken cancellationToken = default)
{
    var db = serviceProvider.GetRequiredService<MyModuleDbContext>();
    await db.Database.MigrateAsync(cancellationToken);

    if (!await db.Categories.AnyAsync(cancellationToken))
    {
        db.Categories.Add(new Category { Name = "Default" });
        await db.SaveChangesAsync(cancellationToken);
    }
}
```
