# Reproducible builds and image pins

The communication image is built from exact package versions, so two builds of the same commit contain the same SDK packages.

* **Exact pins.** `Directory.Build.props` defines the SDK versions as `[x.y.z]` ranges (BwCoreAuthorizationVersion, BwEmailVersion, BwServiceKitVersion); the project
  references them. There are no floating ranges in the service project. Raising a pin is a deliberate commit.
* **Lock file.** `dotnet restore src/BieberWorks.SDK.Communication.Api/Communication.Api.csproj -p:BwLock=true --force-evaluate` writes
  `packages.lock.json` (also pins the transitive packages). Commit it together with a pin change. When the file exists the
  Dockerfile restores with `--locked-mode` and the build fails on any drift (`NU1004`).
* **Base images** are pinned by digest in the Dockerfile. Rebuild rule: bump the digests deliberately (monthly and on .NET
  security releases), rebuild, run the standalone suite, then release a patch version.
* **Local development against unreleased packages.** Copy the pins into an untracked `pins.local.props` with `-dev`
  versions of the local feed, or pass `-p:Name=[x.y.z-dev]`. For the image build use
  `--build-arg BW_RESTORE_ARGS="-p:Name=[...] ..." --build-arg BW_RESTORE_LOCKED=false`.
* **Provenance.** `/info` reports the service version, the source commit (`BW_COMMIT`/`BW_VERSION` build arguments) and the
  real version of every loaded `BieberWorks.SDK.*` assembly. The image carries the matching OCI labels.
* **Release gate.** The `docker-publish` workflow refuses a stable image (no `-` in the version) that resolves a prerelease
  `BieberWorks.SDK.*` package, directly or transitively.
