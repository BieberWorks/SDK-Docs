# Changelog

The changelog is **generated automatically** from [Conventional Commits](https://www.conventionalcommits.org/) and published per release — it is **not** maintained by hand in this repository.

👉 **[View the full changelog on the GitHub Releases page →](https://github.com/BieberWorks/SDK-Components/releases)**

## How it works

- Every release is cut from a git tag (`vX.Y.Z`). The version is computed from the commit messages since the previous tag (`feat:` → minor, `fix:` → patch, `feat!:` / `BREAKING CHANGE:` → major) by the release workflow.
- The same workflow generates the release notes from those commits and attaches them to the GitHub Release. That auto-generated list is the single source of truth.

## What this means for contributors

There is nothing to edit here. Just write clear **Conventional Commit** messages — the changelog takes care of itself.
