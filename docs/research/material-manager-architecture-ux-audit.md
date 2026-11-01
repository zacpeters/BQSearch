# Material Manager Architecture and UX Audit

Status: Phase A audit only. No application code, Scripture pack, analysis report, schema, or deployment configuration was changed for this audit.

## Executive summary

The Material Manager is a local, browser-only preparation tool. It can parse pasted or single-file TXT/CSV/JSON reference lists, normalize references and divisions, assign study numbers, retrieve selected KJV passages during preparation, use a local KJV corpus fallback, review missing/duplicate/retrieval issues, run the deterministic Phase 3A analyzer for one selected division, export one Scripture-pack JSON file, and export one analysis JSON sidecar.

It is not yet a complete multi-division release workflow. The current UI has one import textarea, one selected import division, one review state, one selected analysis division, and separate pack/analysis downloads. The lower-level pack generator can merge rows for a shared reference across divisions, but the current UI does not provide a safe way to prepare and review four division files as one release.

The checked-in 2027 approved pack currently contains 192 Beginner verses only. Its division counts are:

| Division | Current checked-in count | Requested 2027 target |
| --- | ---: | ---: |
| Beginner | 192 | 192 |
| Junior | 0 | 288 |
| Intermediate | 0 | 429 |
| Experienced | 0 | 530 |

The checked-in Beginner analysis sidecar is schema 1.1, analyzes 192 verses, and is checksum-bound to `season-2027-v1` version `1.0.0`. No conclusion can be made about the other target divisions from current repository data.

## Current architecture

### Entry points and separation

- `admin/index.html` and `admin/vite.config.ts` build the local Material Manager separately from the public lookup application.
- `npm run admin:dev` opens `/admin/`; `npm run admin:build` writes `admin-dist/`.
- The public app does not link to or depend on the Material Manager at runtime.
- The Material Manager has no authentication or publishing endpoint. Its header says maintainer workstation only, but this is descriptive UI, not access control.
- Downloads are browser downloads. The tool does not write to GitHub, deploy, or publish automatically.

### State and workflow

`src/material-manager/AdminApp.tsx` keeps the active import, retrieval cache, manual corrections, review, analysis, messages, and pack metadata in React state. A reload loses the in-progress preparation state. The retrieval cache is persisted in localStorage through `RetrievalCache`; approved packs and public settings use the shared IndexedDB through `src/storage.ts`.

The visible sequence is effectively:

1. Import references into a textarea or load one file.
2. Select season, one division, and format.
3. Fetch KJV text or load local corpus text.
4. Review rows and manually correct missing text.
5. Run analysis for the selected division.
6. Export an individual analysis JSON or one approved pack JSON.
7. Optionally install an approved pack into the browser for local lookup testing.

There is no explicit workflow state machine. A user can run review or analysis out of sequence, and the UI prevents some actions with disabled buttons or messages but does not represent a durable import session.

### Import and reference parsing

`src/material/importer.ts` supports:

- Plain text lines.
- CSV rows with reference, division, and study-like columns.
- JSON arrays or `{ references: [...] }` objects.
- Individual references and inclusive same-chapter ranges.
- Canonical book aliases from `src/material/books.ts`.
- Legacy `Juniors` → `Junior` and `Seniors` → `Experienced` mapping.
- Explicit study numbers and sequential assignment for missing numbers.

The parser emits `ReferenceSpec[]` and `ImportIssue[]`. `expandReference()` produces individual canonical references. `reviewReferences()` expands every row for every assigned division, detects duplicate reference/division pairs, and resolves text from manual corrections, retrieved/cache data, or the local corpus.

Current limitations:

- The browser UI reads only `files[0]`, so multi-file selection is not implemented.
- Source filenames are not represented in `ReferenceSpec`, `ImportedReference`, or `ImportIssue`.
- A TXT import receives one `defaultDivision` from the UI. Filename-based division inference does not exist.
- Import format auto-detection treats any comma-containing text as CSV, which can be ambiguous for future comma-separated reference lists.
- Import state is not independently maintained per source file.
- Duplicate warnings are review issues, but there is no file-level conflict view or explicit user decision to merge/replace.

### Material and pack model

The public model in `src/types.ts` is schema `1.0`:

- `ScripturePack` contains season, title, version, status, source metadata, checksum, and a `verses` array.
- `ScriptureVerse` stores one canonical Scripture text row and explicit `divisions` membership.
- `studyNumbers` can hold independent numbers for multiple divisions; legacy packs may use one `studyNumber`.
- `src/division.ts` projects a verse for the active division without inheriting another division's number.

`src/material/pack.ts` groups rows by canonical verse ID, merges division membership and division-specific study numbers, preserves one text value, sorts deterministically, and computes the existing SHA-256 integrity checksum. This is the key compatibility mechanism for a unified pack: shared Scripture text should be represented once with multiple division mappings.

Compatibility constraints:

- Existing public packs and IndexedDB records must continue to load.
- Existing pack checksums are over the canonical schema 1.0 object and cannot be recomputed casually.
- A new unified release must preserve `id`, `version`, `status`, source metadata, canonical verse IDs, exact text, and `studyNumbers` behavior.
- A future multi-file import metadata layer should not be placed inside Scripture verse text or silently alter the checksum contract.
- Filename/source provenance is currently absent from exported pack rows. It can initially remain in a separate preparation manifest or release manifest.

### Retrieval and local corpus fallback

`src/material/retrieval.ts` provides the preparation-only `BibleApiKjvProvider`, bounded batching, contiguous same-chapter requests, throttling, retries, timeout handling, cancellation, response validation, and local cache reuse. The default browser fetcher is wrapped to preserve its invocation context. The provider verifies the requested canonical references, nonempty text, KJV translation metadata, and missing/extra verse behavior.

`src/material/kjv.ts` parses local JSON, USFM, and pipe/tab-delimited text corpus formats. The local corpus is the fallback for offline preparation. It is currently labeled “corpus” in the UI and user-facing copy, which conflicts with the desired simpler terminology.

Current limitations:

- Retrieval cache persistence is localStorage-based and keyed primarily by reference, not by a complete provider/edition/cache namespace contract.
- Manual corrections are retained in the current session and cache, but there is no exported correction audit log in the pack or a durable preparation project.
- The selected provider terms and edition limitation are shown, but there is no centralized source approval record in the Material Manager.
- Retrieval is intentionally not a public-runtime dependency; this separation should remain.

### Validation and review

`validateImportedReferences()` blocks missing text, invalid/input/retrieval issues, and missing study numbers. Duplicate references are warnings. `generatePack()` skips rows without text, so the UI's validation gate is essential; export must remain blocked when required rows are incomplete.

The current review view:

- Shows at most 30 issues.
- Shows at most 100 reference rows.
- Shows canonical reference, study number, division, text, and source label.
- Shows a total error/warning/correction summary.
- Supports a manual correction form.

Risks:

- Truncating review rows can hide unresolved problems in larger 2027 divisions.
- The current report is tied to one selected division and one review state.
- Validation does not yet produce a release-level report that includes all divisions, source-file provenance, manifest entries, analysis compatibility, or cross-file conflicts.
- The pack generator's `status: 'approved'` is a local export convention, not proof of authorized human approval.

### Analysis generation

`src/analysis.ts` and `src/analysis-loader.ts` implement the Phase 3A schema 1.1 contract. The analyzer receives a complete projected division, calculates unique beginnings/endings and division-wide frequencies, preserves original text values and UTF-16 offsets, and emits deterministic annotations and unresolved cases.

The Material Manager currently constructs a synthetic `ScripturePack['verses']` array from review rows for only `importDivision`, then runs `analyzeScriptureDivision()`. It can therefore analyze a division correctly when supplied a complete, valid review for that division, but it does not iterate all divisions or retain independent analysis results in one release session.

The public sidecar loader validates schema version, division, pack ID/version, optional pack checksum, verse IDs, division mappings, and annotation spans. This gives the future release bundle a strong compatibility check: every sidecar must be validated against the exact unified pack it accompanies.

### Export and installation

Current exports:

- One versioned pack JSON download from `exportPack()`.
- One analysis JSON download from `exportAnalysis()`.
- One local pack installation path that verifies an approved/published pack checksum and stores it in IndexedDB.

Not implemented:

- Complete release bundle.
- ZIP or equivalent archive generation.
- Manifest containing file paths, checksums, source files, and analysis reports.
- Proposed filename preview or override.
- Validation report export.
- Previous-release retention/rollback inside the Material Manager.
- Atomic bundle validation before download.

The first bundle implementation should use a deterministic manifest and preserve individual JSON downloads for troubleshooting. It should not silently overwrite checked-in public assets or publish anything.

### Options, Help, and persistence

There is no dedicated Material Manager Options view or contextual Help. Accepted formats are shown in an inline `<details>` block. Recent import choices are not persisted. Retrieval cache persistence exists, but season, division, filename assignments, and review state do not.

The public app's IndexedDB identity is `scripture-lookup`, with `packs` and `settings` stores. The Material Manager's local use of that database for installing approved packs is a compatibility boundary. Any future preparation-project storage should use separate names/stores or an explicitly versioned migration, not overwrite public settings or packs.

### Offline and hosting behavior

The Material Manager is local browser code and can run without a backend when its static assets are available. KJV API retrieval is preparation-time network functionality only. Local corpus loading, parsing, validation, analysis, and JSON export are local.

The public PWA precaches the application shell, checked-in static packs/assets, and checked-in analysis sidecars. The public app does not need the Material Manager or KJV API. A separately hosted Material Manager can remain portable to static hosting, but it cannot provide server-side authorization, repository writes, or secret protection by itself.

## UX audit

### Strengths

- The current cards already communicate a broad preparation sequence.
- Retrieval has visible progress, cancellation, retry, caching, and connection testing.
- Review distinguishes retrieved, cached, manual, and local-source text.
- Export is blocked by the existing validation gate.
- The tool separates public lookup from maintainer-side preparation.
- The local-only architecture supports private preparation without requiring paid infrastructure.

### Main friction points

1. The single textarea is unsuitable for four division lists and makes source provenance hard to retain.
2. One global division selector creates a high risk of assigning a file to the wrong division.
3. The workflow is linear in the visual design but not enforced or summarized as Import → Validate → Analyze → Review → Export.
4. “Corpus” is technical and inconsistent with the user goal; use “Local KJV file” or “Local KJV text” in the interface while retaining internal type names until a deliberate compatibility change.
5. Review truncation is unsafe for release preparation unless the summary clearly says that more rows exist and export validation covers all rows.
6. There is no release-level view of counts, cross-division overlap, missing references, duplicate assignments, or analysis readiness.
7. Analysis is available for one division but there is no sidecar matrix showing which divisions are complete, compatible, unresolved, or stale.
8. Export names and contents are implicit; there is no preview of the final release filename or manifest.
9. No Options/Help surface explains source terms, correction audit behavior, checksums, or the difference between “prepared,” “validated,” and “approved.”
10. Browser refresh loses the preparation session, which is risky for large imports.
11. The local tool has no server-side authorization. A static password unlock can protect settings at rest but cannot protect the tool's code, downloaded artifacts, or repository publication.

## Compatibility requirements

These are required before implementation begins:

- Do not change `ScripturePack` schema `1.0` or `ScriptureAnnotation` schema `1.1` merely to add multi-file provenance.
- Preserve canonical references, exact KJV text, independent division study numbers, existing IDs, and SHA-256 checksum calculation for existing packs.
- Preserve legacy `Juniors`/`Seniors` loading and mapping behavior; make any new canonical division mapping explicit in import UI and reports.
- Keep analysis sidecars separate from Scripture packs and bind each report to pack ID/version/checksum and division.
- Keep public IndexedDB database name `scripture-lookup` and existing pack/settings stores unchanged.
- Never make the public app depend on the KJV API or Material Manager.
- Do not automatically regenerate or overwrite `public/packs` or `public/analysis`.
- Preserve individual JSON exports even after bundle export is introduced.
- Treat “approved” as a workflow state requiring human maintainer review, not as authentication.
- Keep static hosting portable and avoid repository write permissions in browser code.

## Recommended implementation order

### Phase B1: Import session and multi-file intake

Create a preparation-only in-memory import session model with one record per source file: filename, detected/selected division, raw text, format, parsed specs, expanded references, issues, and counts. Add multi-file input, filename suggestions, manual assignment, conflict detection, and a clear per-file review table. Preserve the current single-file path by adapting it into a one-file session.

Do not export source filenames into the existing pack schema yet. Keep provenance in the session and future release manifest.

### Phase C1: Unified multi-division draft

Combine validated file records into one draft. Use the existing grouping behavior to deduplicate shared Scripture text while merging explicit division membership and study mappings. Add release-level checks for missing divisions, duplicate division assignments, nonpositive/nonunique study numbers, and expected-count differences. Add round-trip tests against legacy single-division packs.

### Phase D1: Division analysis matrix

Run schema 1.1 analysis independently for each selected division over its complete eligible set. Display counts and unresolved cases per division. Keep reports separate in memory and export; validate every report against the draft pack identity before allowing bundle export.

### Phase E1: Deterministic release bundle

Add a release manifest with pack path, sidecar paths, schema/analyzer versions, source-file metadata, checksums, counts, and validation status. Generate a ZIP only after all required validations pass. Preview a default filename such as `Psalms-2027-Complete.zip` and allow an override. Keep individual pack/sidecar/manifest/validation-report downloads.

### Phase F1: Guided UX and options

Convert the card flow into visible workflow steps with status badges and a release summary. Replace user-facing “corpus” with “Local KJV file.” Add contextual Help and persist only non-sensitive recent options in a separate Material Manager preference key/store. Do not persist passwords or Scripture text in preferences.

### Phase G1: Presentation configuration

Define a separate versioned presentation configuration contract. Keep administrator defaults, user overrides, presets, and reset behavior outside pack and analysis JSON. Add compatibility translation from existing public Color Coding preferences without changing their key. Decide whether configuration belongs in a local Material Manager export, public static asset, or both before implementation.

### Phase H1: Password-protected local settings

Use Web Crypto authenticated encryption with random salt and nonce, password-derived keys, explicit backup/export, and password-change re-encryption. Document prominently that this is at-rest privacy in a browser, not server-side authorization. Do not use it to imply permission to publish or write to GitHub. This phase should follow a product decision about which settings are actually private.

### Phase I1: Static hosting readiness

Build a separate static Material Manager artifact with base-aware asset handling, no backend assumptions, manual downloads, and an explicit deployment/backup/rollback document. Keep it separate from the public PWA and do not add repository credentials or automatic publication.

## Testing strategy

Before each implementation phase, add pure tests first, then UI tests:

- Multi-file assignment, filename suggestions, conflicts, provenance, and independent parsing.
- Unified pack grouping, shared text identity, division mappings, study-number projection, and legacy round trips.
- Division-specific analysis counts, deterministic output, sidecar checksums, and incomplete division blocking.
- Manifest checksums, bundle contents, filename override, validation-report content, and no-overwrite behavior.
- Guided workflow state transitions and reload-safe recent options.
- Presentation configuration versioning and reset compatibility.
- Encryption round trips, wrong-password failure, backup/restore, and password change; never test or claim server authorization.
- Static hosting base paths and no runtime public API dependency.

## Product decisions required before implementation

1. Should the required 2027 targets be hard validation errors, or should the tool permit other season/division sizes with warnings? Recommended: configurable expected counts, hard errors only when a release declares a complete target season.
2. Should `Junior`/`Experienced` be the only canonical public names, with `Juniors`/`Seniors` legacy aliases? Recommended: yes; preserve aliases on read and never emit them in new release metadata.
3. Should a multi-file import replace, merge, or append to an existing preparation session? Recommended: explicit “New session,” “Add files,” and “Replace file” actions.
4. Which source-file metadata belongs in the release manifest? Recommended: filename, size, content SHA-256, assigned division, parser format, and issue summary; never raw source contents by default.
5. Is a ZIP dependency acceptable for local browser export, or should the first bundle be a downloadable directory/manifest plus individual files? Recommended: use a reviewed, small client-side ZIP dependency only if bundle portability is required; otherwise start with individual deterministic files.
6. What does “approved” mean in this local tool, and who records approval? Recommended: keep it as an explicit maintainer review state and require an external repository-maintainer approval step before checked-in publication.
7. Which settings are private enough to encrypt? Recommended: only non-Scripture operational settings and source/provider notes; never pretend encrypted browser data protects a public static app or repository publication.
8. Should analysis reports be required for all four divisions before a “Complete” bundle can export? Recommended: yes for a declared complete release; allow troubleshooting exports for partial drafts with an unmistakable incomplete status.

## Phase A conclusion

The smallest safe next step is a preparation-session abstraction plus multi-file import, without changing public pack or analysis schemas. Once that is reviewed and tested, the unified pack and per-division analysis matrix can be built on top of the existing grouping, projection, checksum, and schema-1.1 sidecar contracts.

No implementation was started beyond this audit document. No packs were regenerated, published, committed, pushed, or deployed.
