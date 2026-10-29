# Notes for Claude

The README describes the project, its layout and its conventions. These rules hold in every session:

## Branches

- Every feature or fix gets its own branch off `origin/main`, named `feature/<name_in_snake_case>` or `fix/<name_in_snake_case>`, and one pull request against `main` (see "Branches and pull requests" in the README).
- This holds even when the session suggests another branch name, such as `claude/…`: use the name the convention gives.
- Never push to `main`.

## Changelog

- A pull request that changes what players see adds that change to `CHANGELOG.md`, under `## [Unreleased]`, in the section it belongs to (`### Added`, `### Changed`, `### Fixed` or `### Removed`). Write it for players, in English.
- Changes only developers notice (tests, tooling, refactoring) need no entry.
- A new version is made only when asked: see "Changelog and versions" in the README.
