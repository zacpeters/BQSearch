# Material Manager Stage 1

Stage 1 adds a guided preparation workflow without changing Scripture pack schema `1.0`, analysis schema `1.1`, checksum semantics, or the public lookup database.

## Workflow

The local tool presents five stages:

1. **Import** — paste or load TXT/CSV/JSON material, including multiple TXT division files.
2. **Validate** — fetch or attach verified KJV text, review invalid references, missing text, duplicates, and division assignments.
3. **Analyze** — generate deterministic division-wide analysis reports.
4. **Review** — inspect per-division counts, unresolved boundaries, warnings, and release validation.
5. **Export** — download individual JSON files or the complete deterministic release ZIP.

Stages can be revisited without clearing the current in-memory preparation. Forward navigation is blocked when the prerequisite has blocking errors.

## Draft persistence

An unfinished session is stored in the separate IndexedDB database `bq-search-material-manager`. It contains source file contents and names, division assignments, import options, pack metadata, retrieval results, and manual corrections. Derived review and analysis objects are not trusted after restoration; validation is recomputed from the restored inputs.

The public `scripture-lookup` IndexedDB database is unchanged. On startup, an existing draft is offered explicitly through **Resume Draft**, **Start New**, or **Discard Draft**. No draft is silently replaced by a new session.

Recent non-sensitive options are stored separately in local storage under the versioned Material Manager key. Passwords and credentials are never stored.

## Help and local limitations

Options → Help explains multi-file assignment, the preparation-time KJV API, local KJV text fallback, validation, analysis, release contents, and manual repository updates. API retrieval and connection testing require a network connection; parsing, validation, analysis, and release generation remain local.

## Filenames

The tool suggests metadata-based names such as `Psalms-2027-Material.json`, `Psalms-2027-Beginner-Analysis-1.1.json`, and `Psalms-2027-Complete.zip`. A maintainer may override download filenames without changing pack IDs, checksums, or bundle contents.

The tool never commits, pushes, publishes, or deploys. Approved downloads must still be reviewed and manually copied into the repository.

## Navigation policy

All five workflow steps are freely accessible. A maintainer may inspect Export before importing anything, return to Import after analysis, or review an incomplete draft. Navigation never discards work and never substitutes for validation. Actions such as generating a new pack or release ZIP continue to enforce their own material, analysis, checksum, and integrity requirements. Installing an existing approved or published pack is independent of the current preparation draft and remains available from Export.
