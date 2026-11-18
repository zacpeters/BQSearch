# BQQuiz integration plan

Status: planning only. This document describes the proposed integration of the
local BQQuiz application into BQ Search. It does not authorize or begin
application implementation.

## Scope and guardrails

The target is one maintained BQ Search application with Scripture lookup,
question-library management, deterministic quiz generation, and practice
scoring. The integration must preserve the current offline-first lookup path,
the approved Scripture pack contract, existing score-session behavior, and the
ability to roll back the quiz vertical without invalidating installed Scripture
data.

The first implementation should be incremental and test-gated. Published quiz
content must remain separate from user-created content, and no copyrighted or
restricted source PDFs should be copied into a public deployment artifact.

## Existing BQ Search architecture

BQ Search is a React + TypeScript + Vite client application with a generated
PWA shell. `src/main.tsx` boots the public app and `src/App.tsx` owns the search,
settings, material-manager, and live-score views. Search is local and
synchronous: `src/search.ts` parses references, words, phrases, and study-number
queries against an in-memory verse projection. `src/division.ts` applies
division-specific study-number projections and range normalization.

The versioned domain contracts are in `src/types.ts`. A `ScripturePack` contains
season metadata, verses, per-division study numbers, source metadata, and an
integrity checksum. The approved static fallback is
`public/packs/season-2027-v1-1.0.0.json`; analysis sidecars are loaded by
`src/analysis-loader.ts` from `public/analysis/`.

`src/storage.ts` owns the `scripture-lookup` IndexedDB database with `packs`,
`settings`, and `live-sessions` stores. Pack downloads are validated before
being retained locally. This database and its existing stores are a compatibility
boundary and must not be renamed or overwritten by the quiz feature.

The local preparation pipeline is intentionally separate from public lookup:

- `src/material/importer.ts`, `src/material/pack.ts`, and `src/material/types.ts`
  parse references, validate imported text, generate approved packs, and compute
  checksums.
- `src/material/retrieval.ts` contains the preparation-only KJV provider,
  throttling, retries, cancellation, and local cache behavior.
- `src/material-manager/AdminApp.tsx`, `src/material-manager/main.tsx`, and
  `src/material-manager/drafts.ts` implement the separate local material
  workflow.
- `vite.config.ts` generates the public service worker and manifest. The Pages
  workflow is `.github/workflows/deploy-pages.yml`; `admin/vite.config.ts` is a
  separate local/admin build configuration.

The current deployment is GitHub Pages at `/BQSearch/`. The workflow runs tests,
pack validation, and production builds only for `main`. It does not generate or
approve material.

## Existing BQQuiz architecture

BQQuiz is also a local React + TypeScript + Vite application. Its core contracts
are in `src/models.ts`, with reusable features in:

- `src/data/catalog.ts` for the immutable extracted catalog;
- `src/data/normalize.ts` for classification and Scripture-reference parsing;
- `src/data/importers.ts` for versioned CSV/JSON user imports;
- `src/features/generation/generator.ts` for classification filters, coverage
  eligibility, seeded selection, balanced/random strategies, and pool counts;
- `src/features/scripture/provider.ts` for the `ScriptureProvider` seam;
- `src/features/practice/practice.ts` for attempt, interruption, reread, and
  session transitions;
- `src/db/sessionDb.ts` for IndexedDB persistence;
- `src/components/LibraryV5.tsx`, `QuestionBankV5.tsx`, `GeneratorV5.tsx`, and
  `PracticeViewerV5.tsx` for the reusable library, bank, generator, and practice
  UI.

The extracted 2027 catalog is `src/data/extracted/2027/index.json`. It contains
45 quizzes and 900 questions. `PublishedQuiz` records reference immutable
question IDs; generated quizzes store question IDs, seed, filters, distribution,
and total points. User collections and questions are separate from bundled
published content.

The BQQuiz phases establish the intended behavior: collection-first Library
navigation, immutable published collections, editable user collections, atomic
CSV/JSON preview-and-commit, strict all-reference coverage, searchable range
selectors, classification filtering, deterministic generation, local presets,
and a practice viewer with scoring, interruption slashes, rereads, NR, undo,
printing, and local autosave.

## Shared Scripture provider and study-order model

The integration should implement the BQQuiz `ScriptureProvider` interface as an
adapter over the active BQ Search pack rather than copying Scripture text into
question records. The adapter should resolve a normalized
`ScriptureReference` to the matching `ScriptureVerse` in the selected season,
division, and study range, returning an explicit unavailable result when the
pack does not contain the requested verse.

The BQ Search pack remains authoritative for Scripture text and study order.
`studyNumber` is not derived from chapter/verse and must remain independent. The
adapter should expose both canonical reference ordering and division-specific
study ordering so that:

1. lookup range selectors continue to use the existing division projection;
2. quiz coverage filters can use normalized Scripture references;
3. a future study-number selector can map a quiz question to the active
   division without guessing from chapter/verse;
4. multi-reference questions remain all-or-nothing under strict range rules.

The provider should be a pure boundary over loaded local data. It must not call
the preparation-only `src/material/retrieval.ts` provider or introduce a runtime
network dependency into search, practice, or generation.

## Quiz Library, Question Bank, Generator, and Practice integration

The BQQuiz feature areas should be brought into the BQ Search shell as a
separate route/view group, initially behind a feature flag if needed:

- **Quiz Library:** adapt `LibraryV5.tsx` to show published collections and
  quizzes first, then user collections and saved generated quizzes. Published
  content remains read-only. The active BQ Search season and division should be
  visible in the library context.
- **Question Bank:** reuse the data contracts and behaviors in
  `QuestionBankV5.tsx` and `src/data/importers.ts`. Keep preview-before-commit,
  duplicate detection, reference warnings, atomic writes, and separate user
  content. Do not allow edits to bundled questions.
- **Generator:** reuse `generator.ts` and `GeneratorV5.tsx`, replacing the
  unavailable provider with the shared BQ Search adapter. Preserve seeded
  generation, 10/20/30 point pools, balanced/random strategy, saved presets,
  and live availability counts.
- **Practice:** reuse `practice.ts` and `PracticeViewerV5.tsx` for question
  presentation, references, scoring, interruption/reread transitions, NR,
  activity history, printing, and local save/restore. Scripture reference
  controls should open the shared local lookup drawer rather than a second text
  implementation.

The first integration should prefer adapters and component composition over a
large rewrite. BQ Search should own the application shell, season/division
context, service worker, and Scripture storage; BQQuiz should own question,
generation, and practice domain logic until the behavior is covered by shared
tests.

## Restore study-number range selectors

The current BQ Search context bar displays the effective study range, but the
integration must restore explicit start and end selectors for quiz generation
and lookup configuration. The selector options must be derived from the active
division's actual pack records, using `getDivisionStudyRange()`,
`projectVersesForDivision()`, and `resolveStudyRange()` in `src/division.ts`.

Selectors must not synthesize missing sequence numbers. They should show the
available study numbers and their Scripture references, clamp invalid saved
values, preserve the existing `999`/all-range compatibility behavior, and save
through the existing settings migration path. A generated quiz must record the
normalized range used at generation time so later changes to the active lookup
range do not silently change a saved quiz.

## Restore question-type filtering

The BQQuiz generator already models `classifications` in `GenerationFilters` and
normalizes classification strings in `src/features/generation/generator.ts`.
The integrated Generator should restore the visible question-type chips or
selectable filters from `GeneratorV5.tsx`, populate options from the catalog,
and update point pools immediately when types change. Filtering must be
case-insensitive and tolerant of spaces/hyphens while preserving the original
classification for display and export.

## Nine questions excluded from strict range generation

The 2027 catalog has exactly nine questions with no structured references. Under
the documented strict rule, a restricted range requires at least one reference
and every reference must fall inside the selected range. These questions remain
available for unrestricted generation and browsing, but are excluded from any
restricted-range pool and must be counted in availability diagnostics:

1. `lift-up-2027-quiz-01-q-12` — Quiz 1, Q12, “Psalm Chapter 5 requests lead
   me IN what because OF what, make thy way straight BEFORE what?”
2. `lift-up-2027-quiz-06-q-02` — Quiz 6, Q2, “Verse 6 of Psalm Chapter 4
   mentions what ‘light’?”
3. `lift-up-2027-quiz-08-q-02` — Quiz 8, Q2, “What ‘brightness’ is mentioned
   in Psalm Chapter 18?”
4. `lift-up-2027-quiz-08-q-08` — Quiz 8, Q8, “Psalm Chapter 18 mentions what
   day?”
5. `lift-up-2027-quiz-13-q-08` — Quiz 13, Q8, “What hath made me great, as
   recorded in Psalm Chapter 18?”
6. `lift-up-2027-quiz-15-q-10` — Quiz 15, Q10, the cross-reference four-part
   question covering Psalm 11:4–5.
7. `lift-up-2027-quiz-19-q-05` — Quiz 19, Q5, “According to Psalm Chapter 18,
   what ‘kindled’ what?”
8. `lift-up-2027-quiz-19-q-08` — Quiz 19, Q8, “Psalm Chapter 18 mentions what
   ‘shield’?”
9. `lift-up-2027-quiz-20-q-06` — Quiz 20, Q6, “At what did ‘thick clouds’ pass?”

Do not infer references from question wording as part of this integration.
Reference corrections require a reviewed catalog update and explicit source
audit.

## Local Scripture lookup integration

Practice reference links should use the active BQ Search pack and the shared
provider. The drawer should show the normalized reference, verse text when
available, season/division context, and an unavailable state when the pack does
not cover the verse. It should reuse the existing local lookup presentation and
copy/context affordances where practical.

The public app must continue to work offline after the pack is installed. The
quiz catalog may be bundled or installed separately, but it must never replace
the Scripture pack record or bypass pack checksum validation. A question's raw
text and answer remain question-bank data; Scripture text remains provider data.

## IndexedDB export/import migration

Keep the existing database names during the first migration:

- BQ Search: `scripture-lookup`, currently managed by `src/storage.ts`;
- BQQuiz: `bqquiz-local`, currently version 3 and managed by
  `src/db/sessionDb.ts`.

Add an explicit versioned export/import bridge instead of silently merging
schemas. The export should include a manifest with schema version, source app,
created timestamp, catalog/content identifiers, and separate sections for user
collections, user questions, generated quiz definitions, coverage presets, and
practice sessions. It must exclude installed Scripture packs, credentials, and
unapproved source PDFs.

Import must preview counts, IDs, schema compatibility, duplicate/conflict
decisions, and reference warnings before one atomic transaction. Existing IDs
must not be overwritten by default; conflicts should be skipped, replaced only
after explicit confirmation, or remapped with a recorded mapping. BQ Search's
`packs`, `settings`, and `live-sessions` stores must never be deleted by a quiz
import. Future schema changes require a migration function and fixtures for
both existing databases, including a backup/export before destructive changes.

## Single service-worker strategy

The integrated deployment should have one service worker owned by the BQ Search
Vite build. `vite-plugin-pwa` in `vite.config.ts` should remain the source of
truth for registration, scope, precache, update behavior, and the `/BQSearch/`
base path. The standalone BQQuiz `public/sw.js` must not be registered or
shipped as a competing worker once its feature code is integrated.

The final worker should cache the application shell and explicitly versioned,
approved static content. User data remains in IndexedDB. Any worker change must
be tested for scope, update/reload behavior, stale-content recovery, offline
lookup, and direct navigation to every integrated route. The admin/material
preparation tool remains a separately hosted/local workflow and must not gain
access to the public worker's approval or publishing authority.

## GitHub branch protection

Protect `main` before merging the integration. Recommended rules are:

- require pull requests and at least one approving review;
- require the full test, pack-validation, type-check, and production-build
  status checks;
- require branches to be up to date before merge;
- disallow force pushes and branch deletion;
- restrict direct pushes and workflow-file changes to maintainers;
- require CODEOWNERS review for deployment, pack, service-worker, and migration
  changes;
- keep `feature/bqquiz-integration` and preview branches mergeable without
  granting them production deployment permissions.

No integration branch should push to `main` directly, and no preview workflow
should be able to publish official material.

## Isolated Cloudflare Pages preview proposal

Create a separate Cloudflare Pages project for integration previews, connected
to the feature branch or to pull-request artifacts. It must use a distinct
project name, preview URL, environment variables, cache namespace, and
deployment credentials from production GitHub Pages. The preview build should
use a separate base path or root domain and must not share production service
worker scope.

Because static Pages content is public by default, “preview” is not an access
control. If the catalog contains published quiz content that is not ready for
public distribution, protect the preview hostname with Cloudflare Access using
an allowlisted maintainer/team identity provider or short-lived service tokens.
Add `X-Robots-Tag: noindex, nofollow`, avoid indexing links, and keep sensitive
source PDFs and credentials out of the artifact. Validate that preview URLs do
not expose production APIs, production IndexedDB assumptions, or deployment
tokens. Production remains the existing GitHub Pages workflow until a separate
hosting migration is approved.

## Phased implementation

### Phase 0 — contracts and safety

Freeze and document the provider, question, generated-quiz, and export bundle
contracts. Add fixtures for the approved BQ Search pack, the 900-question catalog,
the nine no-reference questions, existing `scripture-lookup` records, and
`bqquiz-local` version-3 records. Add branch protection and a non-production
preview pipeline before enabling production-facing integration.

### Phase 1 — shared data and provider

Implement the BQ Search-backed `ScriptureProvider`, normalized reference and
study-order utilities, explicit migration/export bridge, and compatibility tests.
No navigation or production deployment change should be required to land this
phase.

### Phase 2 — read-only Library and Question Bank

Bring in catalog loading, collection-first Library navigation, read-only
published content, user collections, question-bank search, and import/export
preview. Keep generated/practice actions disabled until persistence and conflict
handling are verified.

### Phase 3 — Generator and restored selectors

Add study-number range selectors, question-type filtering, strict all-reference
eligibility, the nine-question diagnostic, seeded generation, availability
counts, presets, and saved generated quiz definitions.

### Phase 4 — Practice and Scripture drawer

Integrate the practice viewer, scoring state machine, interruption/reread/NR
controls, undo/history/printing, local save/restore, and provider-backed local
Scripture drawer. Verify that existing BQ Search Live Scorer sessions continue
to load independently.

### Phase 5 — release hardening

Enable the integrated route by default only after automated and manual acceptance
criteria pass. Publish a protected Cloudflare preview, review bundle sizes and
service-worker behavior, and merge through a protected pull request. Production
material changes remain separate reviewed commits.

## Automated testing and acceptance criteria

Required automated coverage should include:

- provider resolution from an installed BQ Search pack, division projection,
  missing-verse/unavailable behavior, and reference normalization;
- study-number selector options, clamping, persistence, and all-range behavior;
- question-type normalization and filtering;
- strict range eligibility, including multi-reference questions and all nine
  no-reference exclusions;
- deterministic seeded generation, point-pool shortages, balanced/random
  strategy, no duplicate source IDs, and saved filter metadata;
- Library and Question Bank read-only published behavior, user CRUD, import
  preview, duplicate/conflict handling, atomic commit, export round-trip, and
  schema migration;
- practice transitions for correct, incorrect, interruption, reread, NR, undo,
  restore, and Scripture drawer references;
- IndexedDB coexistence so quiz import cannot mutate BQ Search packs/settings;
- service-worker scope, base path, direct route refresh, offline shell, and
  update behavior;
- existing BQ Search tests, `npm run validate:packs`, `npm test`, `npm run
  build`, and the production-base-path build.

Acceptance requires a clean install to search offline, load the approved pack,
open the Library, generate a range/type-filtered quiz with reproducible output,
open every reference locally, save and restore practice, export/import user
content without losing lookup settings, and pass the existing deployment
workflow without changing its production trigger or publishing authority.

## Rollback and production safety

Keep the integration behind a route or feature flag until Phase 5. A rollback
must be a normal revert or deployment of the last known-good artifact; it must
not delete IndexedDB databases or silently downgrade user data. Before every
schema migration, offer a versioned export and retain the previous migration
reader for at least one release.

The production GitHub Pages workflow remains unchanged until the integration is
approved. Official Scripture packs, analysis sidecars, release manifests, and
quiz catalogs are reviewed independently. Preview credentials never enter the
repository or client bundle. No pull request is created or merged as part of
this planning task.

## Recommended first implementation stage

Start with Phase 0 and Phase 1: lock the shared contracts, add fixture-based
compatibility tests, and implement the local-pack `ScriptureProvider` plus the
versioned export/import bridge. This establishes the safest seam for the later
Library, Generator, and Practice work without changing production navigation or
the existing GitHub Pages deployment.

## Phase 0–1 implementation report

Implementation status: complete for the non-UI foundation. The BQQuiz UI,
catalog, production routes, service worker, Cloudflare infrastructure, and
automatic migration remain intentionally inactive.

### Files changed

- `src/integration/contracts.ts` — shared Scripture, pack identity, lookup
  result, and migration record contracts.
- `src/integration/scripture-provider.ts` — pure BQ Search pack-backed provider
  and reference normalization/order utilities.
- `src/integration/migration.ts` — versioned JSON bundle creation, validation,
  preview, conflict planning, independent `bqquiz-local` IndexedDB access, and
  atomic commit.
- `src/integration/scripture-provider.test.ts` — approved-pack provider
  compatibility fixtures and behavior tests.
- `src/integration/migration.test.ts` — migration manifest, validation,
  conflict, relationship, round-trip, and BQ Search coexistence tests.

No BQQuiz files were modified. The inspected BQQuiz source files were preserved
in a temporary recoverable snapshot before adaptation; the source folder was
read-only throughout this phase.

### Shared contracts and provider API

`src/integration/contracts.ts` defines `ScriptureReference`,
`NormalizedScriptureReference`, `ScripturePackIdentity`,
`ResolvedScriptureVerse`, `ScriptureLookupResult`, and `ScriptureProvider`.
`ScriptureProvider` exposes:

```ts
getVerse(reference): Promise<ScriptureLookupResult>
getVerses(references): Promise<ScriptureLookupResult[]>
getByStudyNumber(studyNumber): ScriptureLookupResult | undefined
```

`createPackScriptureProvider(pack, { division, studyStart?, studyEnd? })` uses
the active approved pack only. It normalizes book aliases, resolves a single
verse or inclusive multi-verse range, preserves the pack's division-specific
study number, and returns pack ID/version/season/source metadata with every
result. `getVerses()` supports multiple citations without merging them into a
single ambiguous result.

Unavailable results are explicit and never contain fabricated text:
`invalid-reference`, `missing-verse`, `outside-division`, and
`outside-study-range`. Canonical order is derived from the existing book order;
study order is always read through `getDivisionStudyNumber()` and the pack's
actual mapping. The provider does not import or call `src/material/retrieval.ts`
and has no network dependency.

### Migration format and conflict policy

The JSON format identifier is `bqsearch-bqquiz-user-data`, version `1`. A
manifest records source application, source schema version, export timestamp,
data counts, and optional catalog ID/version. Data is limited to user
collections, user questions, custom quizzes, coverage presets, and practice
sessions. Scripture packs, BQ Search settings/live sessions, credentials,
tokens, source PDFs, and caches are excluded.

Example manifest using fabricated values:

```json
{
  "format": "bqsearch-bqquiz-user-data",
  "formatVersion": 1,
  "sourceApplication": "bqquiz",
  "sourceSchemaVersion": 3,
  "exportedAt": "2030-01-02T03:04:05.000Z",
  "counts": {
    "userCollections": 1,
    "userQuestions": 2,
    "customQuizzes": 1,
    "coveragePresets": 1,
    "sessions": 1
  },
  "catalogId": "example-catalog",
  "catalogVersion": "example-1"
}
```

Import is explicit and never runs at startup. `validateMigrationBundle()` checks
the format/version and required record shapes. `previewMigration()` reports
duplicate or conflicting IDs, missing collection/question/quiz relationships,
reference warnings, counts, and any planned remapping. The default
`skip-existing` policy preserves existing records and skips exact duplicates;
`replace-existing` is explicit; `remap-conflicts` creates stable suffixed IDs
and rewrites dependent collection, question, quiz, and session references while
returning the mapping.

`commitMigration()` validates and previews before opening the independent
`bqquiz-local` version-3 database. It writes all five quiz stores in one
read/write IndexedDB transaction. Validation failures occur before writes, and
transaction errors abort the whole commit. The `scripture-lookup` database is
never opened by the bridge.

### Test coverage

The new 13-test focused suite covers approved-pack single-verse, multi-verse,
multiple-citation, study-number, division, range, invalid, missing, and pack
version behavior. Migration tests cover empty and malformed bundles,
unsupported versions, conflict preview, missing relationships, stable
round-trip records, replacement, remapping, and rejected-import coexistence
with BQ Search packs, settings, and live-score sessions. Existing BQ Search
search, division, storage, material, and pack behavior remains covered by the
repository's existing test suite.

### Remaining gaps and risks

- The BQQuiz UI still has no route or visible integration; this is intentional.
- A future UI must provide a user-facing export/download and preview/commit
  flow around these pure functions rather than invoking import on startup.
- The bridge currently targets the documented BQQuiz version-3 store shape and
  needs a future migration reader if BQQuiz changes its schema.
- Browser service-worker, route-refresh, and production deployment checks are
  deferred because no UI or worker changed in Phase 0–1.
- Conflict remapping is deterministic within a preview but should be surfaced
  to users and persisted alongside a future import audit record.

### Validation and next stage

The focused compatibility tests and TypeScript check pass. Full repository
validation is run separately after this report is recorded. The next stage is
Phase 2: read-only catalog loading and Question Bank/Library adapters, still
without Generator or Practice UI activation.

## Phase 2 implementation report

Implementation status: complete for the local-development Library and Question
Bank foundation. The catalog remains opt-in, local-only, and absent from the
repository and production build. Generate Quiz and Practice are not implemented
or exposed.

### Files and feature boundary

Added the isolated `src/features/quizzes/` boundary:

- `types.ts` — catalog, published question/quiz/collection, and user-record
  contracts adapted from the reviewed BQQuiz model.
- `catalog/loader.ts` — schema/version validation, relationship checks, ID
  preservation, reference warnings, and explicit file parsing.
- `catalog/storage.ts` — catalog-only IndexedDB database access.
- `library/QuizLibrary.tsx` — collection-first Library, quiz lists, counts,
  original order, source metadata, and read-only question preview.
- `question-bank/QuestionBank.tsx` — search, filters, user CRUD, source and
  reference display, and migration-compatible user export.
- `question-bank/importers.ts` — CSV/JSON preview parsing and reference warnings.
- `storage/user-storage.ts` — explicit access to the existing BQQuiz version-3
  user stores without touching BQ Search Scripture stores.
- Matching synthetic tests for catalog validation, catalog persistence, and
  question-bank import behavior.

`src/App.tsx` now has a minimal `Quizzes` entry controlled by
`VITE_ENABLE_QUIZZES === 'true'`. The feature is lazy-loaded and uses the
existing BQ Search shell, toolbar, context, styles, theme, and back navigation.
No second application shell or service worker was added. `.gitignore` includes
local catalog filename/directory safeguards.

### Safe catalog-loading architecture

The 45-quiz/900-question BQQuiz catalog was not copied, imported, or hashed into
tracked BQ Search files. The feature accepts an explicitly selected JSON file
through the local **Install local catalog** control. `validateCatalog()` requires
schema version 2, source-set metadata, unique collection/quiz/question IDs,
valid collection and quiz relationships, required question fields, point values,
source metadata, and preserved question arrays. It does not rewrite question
wording, answers, classifications, IDs, order, or references. Invalid references
are reported as warnings so browsing is not blocked.

Installed catalogs are stored in the separate, versioned `bqsearch-quizzes`
IndexedDB database under `published-catalogs`. Published records are read-only.
The existing `bqquiz-local` database remains the user-data boundary, and
`scripture-lookup` is never opened by the catalog installer. Replacing a catalog
is explicit and does not clear user collections or questions. No startup catalog
installation or data migration occurs.

When no catalog is installed, the feature shows an explanatory local-file empty
state. To run the local experience:

```sh
VITE_ENABLE_QUIZZES=true npm run dev
```

Open the local BQ Search URL, choose **Quizzes**, select **Install local
catalog**, and provide an authorized catalog JSON file outside this repository.
Use **Library** for collection/quiz browsing and **Question Bank** for filters,
user collections, user questions, imports, and export. The catalog file is not
served by Vite, copied to `public/`, or included in deployment output.

### Library

The collection-first Library preserves publisher identity, collection and quiz
IDs, quiz numbering, question counts, point totals, source filenames, original
question order, and read-only published records. Users can search collections,
open a quiz, and expand individual question previews. Generate and Practice
actions are intentionally absent.

### Question Bank

Question Bank supports question/answer/reference search, collection, publisher,
point-value, classification, and Scripture-reference filters. Published and
user-created records are visually distinguished. User collections can be
created, renamed, and deleted with confirmation; user questions can be created,
edited, and deleted with confirmation. Point values and reference syntax are
validated, stable IDs are preserved, and published records are never edited or
copied implicitly.

CSV and JSON imports are preview-only until the user explicitly commits. The
preview reports malformed records, duplicate IDs, and reference warnings. The
commit writes user collections/questions in one IndexedDB transaction and skips
IDs already used by the published or user set. JSON imports accept both the
original BQQuiz `{ collections, questions }` shape and the Phase 0–1 migration
bundle's `data.userCollections`/`data.userQuestions` shape. Export uses the
Phase 0–1 versioned migration bundle and therefore remains compatible with the
existing bridge.

Reference chips use the Phase 0–1 `ScriptureProvider` against the active BQ
Search pack and display local, checking, invalid, missing, division, or range
states. Scripture text is not duplicated into question records.

### Tests and browser status

Added synthetic tests for no/valid/unsupported/duplicate/missing-reference
catalogs, immutable published data, original ordering, point values and
classifications, isolated catalog replacement, CSV/JSON import preview,
duplicate handling, and migration-bundle compatibility. The full repository
suite passes without weakening existing tests.

Browser validation was not run. This checkout has no configured Playwright
script or browser test suite for the new feature, and no browser dependency was
installed for this phase. The local development path is covered by TypeScript,
Vitest, and production-build checks; visual and refresh-persistence validation
remain Phase 2 follow-up work before wider enablement.

### Security, deployment, and remaining work

The default build has the feature flag off. The locally enabled build contains
only quiz code and validation logic; a production-output scan found no
published BQQuiz IDs, titles, question wording, or answers. The existing
GitHub Pages workflow, PWA/service-worker configuration, public assets, and
Cloudflare state are unchanged. The original BQQuiz project remains unchanged.

Remaining functionality includes richer CSV quoting, user-facing conflict
remapping UI, catalog deletion/history, browser-level accessibility and
responsive checks, and an explicit catalog integrity/signature policy. The
feature is not ready for production enablement or deployment.

Phase 3 prerequisites are a reviewed local catalog contract, a user-visible
conflict/import audit flow, browser validation of Library and Question Bank, and
approval to add the Generator route. Phase 3 must continue to keep generation
and practice disabled until those prerequisites pass.

## Phase 3 implementation report

Phase 3 adds the locally enabled Generator and completes the deferred browser
validation. The work remains isolated behind `VITE_ENABLE_QUIZZES=true`; the
default build and existing Lookup/Score Sheet behavior are unchanged. Practice,
deployment, Cloudflare, and production catalog publication remain out of scope.

### Files and architecture

The Generator domain logic is in `src/features/quizzes/generator.ts`. It adapts
the tested BQQuiz selection behavior while using BQ Search's
`projectVersesForDivision`, `getDivisionStudyNumber`, and normalized Scripture
references. `src/features/quizzes/generator/QuizGenerator.tsx` is the local
configuration and preview UI; `GeneratedQuizList.tsx` provides saved-quiz
rename, duplicate, delete, and missing-content diagnostics. Generator records
and coverage presets use the existing `bqquiz-local` version-3 boundary through
`src/features/quizzes/storage/generator-storage.ts`; no new service worker or
database is introduced.

The study selectors are searchable, keyboard/touch-compatible inputs backed by
the active pack's actual division projection. Options display `#study number ·
reference`, preserve gaps, and reject invalid or reversed ranges. Presets retain
season, division, pack, catalog, and resolved study-number context; an
incompatible preset is reported instead of being silently applied.

### Generator behavior

The Generator supports collection and publisher intersection filters, normalized
classification filters, all/select-all/clear-all type controls, balanced and
seeded-random strategies, the default 8/9/3 distribution, custom point counts,
live pool counts, shortage diagnostics, deterministic ordering, preview, save,
rename, duplicate, delete, refresh persistence, and regeneration from saved
parameters. Generated quizzes preserve source IDs, point values,
classification, references, source metadata, seed, and normalized filters.

Restricted coverage requires every structured reference to resolve in the
active pack/division and to fall inside the selected actual study-number range.
Reference-less questions remain browseable and eligible only for unrestricted
generation. The nine approved Lift Up reference-less IDs (`Q1-12`, `Q6-2`,
`Q8-2`, `Q8-8`, `Q13-8`, `Q15-10`, `Q19-5`, `Q19-8`, `Q20-6`) are not given
invented metadata and are reported in restricted-range diagnostics.

### Phase 2 hardening

Catalog loading now computes a reproducible canonical SHA-256 digest and can
compare it with an independently supplied trusted digest. The catalog remains
an explicit local installer input and is stored separately from user content.
CSV import now handles quoted commas, escaped quotes, CR/LF, and multiline
fields. Import previews report malformed rows, duplicate IDs, reference
warnings, and existing IDs that will be skipped; commit is explicit and does
not overwrite records. Saved generated quizzes resolve both published and user
question IDs and report missing content without substitution. Vitest excludes
Playwright files so `npm test` remains the unit-test command.

### Browser validation

Playwright is configured in `playwright.config.ts` and
`playwright.off.config.ts`, using the installed Chrome channel and a local Vite
server. Committed synthetic fixtures contain no published quiz wording or
answers. Desktop enabled tests passed for catalog installation, refresh
persistence, Library/Question Bank navigation and search, user collection and
question creation, and Generator controls/preview. The iPad-sized Chromium
profile passed the same flows. The separate feature-flag-off suite passed and
confirmed the Quizzes navigation is absent. Browser tests also dismiss the
existing first-run walkthrough as test setup; the application walkthrough was
not changed.

Run locally with:

```sh
VITE_ENABLE_QUIZZES=true npm run dev
npm run test:browser
npm run test:browser:off
```

Install an authorized catalog through **Quizzes → Install local catalog**. Do
not place the published catalog in this repository, `public/`, or Vite output.

### Validation and remaining work

Phase 3 validation includes `npm run validate:packs`, the full Vitest suite,
`npx tsc --noEmit -p tsconfig.app.json`, `npm run build`, desktop and
iPad-sized Playwright suites, and the flag-off Playwright suite. The production
output scan found no restricted published quiz IDs, titles, wording, or
answers. The production workflow, existing service worker configuration,
original BQQuiz source, and `scripture-lookup` database remain unchanged.

Practice integration is the next stage. It still needs the Practice Scripture
drawer, session lifecycle integration, and any required generation-to-practice
handoff. Catalog authenticity remains digest-based unless a separately trusted
signature/manifest is supplied; a hash embedded in the catalog itself is not
treated as proof of authenticity.

## Public 2027 catalog on the integration branch

On November 18, 2026, the user explicitly authorized public distribution of
`BQQuiz/src/data/extracted/2027/index.json`, including the BQ Powers and Lift Up
published questions and answers. This supersedes the earlier local-only
restriction for that exact file. The authorization covers 45 quizzes and 900
questions across the two collections. It excludes the original PDFs, extraction
artifacts, browser exports, and other BQQuiz source material.

The byte-for-byte copy lives at
`src/features/quizzes/catalog/bqquiz-2027.json`. The source file SHA-256 is
`5fb0bbc4aad5a10ae2b1f118b50e0ea0292f2be2add81c7641d91a7e01ab2f4b`.
Quizzes verifies its canonical JSON SHA-256 against the value pinned in
`catalog/bundled.ts` before exposing any records. The nine source questions
without structured references retain that metadata as supplied.

With `VITE_ENABLE_QUIZZES=true`, Vite emits a content-hashed catalog asset and
the existing Workbox service worker precaches it under the configured base
path. The Library, Question Bank, and Generator use the verified catalog on
first open. An approved update replaces the bundled version through the app
and service worker update, with no automatic writes to catalog records. When published
collection IDs overlap, the bundled collection takes priority. Other locally
installed collections remain available, with newer manual installs taking
priority over older manual installs for the same IDs. Existing user records
and saved quizzes stay in their own stores.

**Quizzes → Advanced catalog options → Install local catalog** accepts a
reviewed manual catalog and an optional trusted SHA-256. If the bundle fails
to load or verify, Quizzes can still use available manual installations.

To migrate a browser-only collection, open the original BQQuiz in the browser
profile and at the origin where it was created. Use **Question Bank → Export**
to save `bqquiz-user-content.json` locally. In BQSearch, use
**Quizzes → Question Bank → Import**, review the counts and skipped IDs, and
select **Commit import**. This transfers user collections and questions.
Keep the export private and retain the original profile for BQQuiz saved
practice sessions, generated quizzes, and presets.

Use `npm run test:browser` to run the enabled production build with the
`/BQSearch-Preview/` base path and exercise desktop and iPad-sized viewports.
Run `npm run test:browser:off` to verify flag-off navigation. Run
`npm run validate:packs` and `npm test` for pack and catalog validation.
When updating the bundled JSON, verify approval for the new bytes, update the
pinned canonical digest, and coordinate the exact file SHA-256 with the
separate preview artifact check. The preview can be refreshed immediately
through **BQSearch-Preview → Actions → Deploy BQ Search preview → Run workflow**.
