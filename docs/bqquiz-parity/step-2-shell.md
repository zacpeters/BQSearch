# BQQuiz parity migration, Steps 1 and 2

Quizzes uses the shared BQSearch toolbar and theme. This revised Step 2 is for local review on `feature/bqquiz-integration`. The original V5 screen migration begins at Step 3.

## Baseline and scope

- **BQSearch base revision** `df44d353750824d6ae3eebd4ee24661d89f43d88`.
- **Original BQQuiz source** `/Users/zacpeters/Documents/Development/BQQuiz`. This directory has no Git metadata, so the [SHA-256 ledger](original-source.sha256) pins the active V5 source, catalog, dependency lockfile and exact build used for screenshots. All 21 hashes were checked against the original directory. The bundled catalog still matches the approved source byte for byte.
- **Synthetic storage fixtures** [BQQuiz and BQSearch record shapes](../../tests/fixtures/bqquiz-parity-storage.json). The two sets cover user collections and questions, coverage presets and saved quizzes, plus an original-style pending-reread session. Saved quiz arrays deliberately put Question 2 before Question 1. The browser tests compare the full five-store snapshot before and after shell navigation.
- **Differences to track separately** [original V5 defects](v5-known-defects.md). Future Practice reads will use the active division's full Scripture coverage and the saved quiz's exact question order. Full five-store transfer belongs to a later step.

## Navigation comparison

| Viewport | Original V5 | Unified Step 2 |
| --- | --- | --- |
| Desktop, 1440 px | [Library](screenshots/original-desktop-library.png) | [Light](screenshots/embedded-desktop-light.png) · [Dark](screenshots/embedded-desktop-dark.png) |
| iPad portrait, 810 px | [Library](screenshots/original-ipad-library.png) | [Light](screenshots/embedded-ipad-light.png) · [Dark](screenshots/embedded-ipad-dark.png) |
| iPad landscape, 1080 px | [Library](screenshots/original-ipad-landscape-library.png) | [Light](screenshots/embedded-ipad-landscape-light.png) · [Dark](screenshots/embedded-ipad-landscape-dark.png) |
| Phone, 390 px | [Library](screenshots/original-phone-library.png) | [Light](screenshots/embedded-phone-light.png) · [Dark](screenshots/embedded-phone-dark.png) |

Original desktop references for later steps are [dark mode](screenshots/original-desktop-dark.png), [Question Bank](screenshots/original-desktop-question-bank.png), [Generator](screenshots/original-desktop-generator.png), [Saved quizzes](screenshots/original-desktop-saved.png) and [Practice](screenshots/original-desktop-practice.png). Captures use fresh Chromium contexts. The original Saved and Practice examples came from a newly generated quiz in the disposable browser context.

BQSearch provides the only application toolbar, logo, theme toggle and settings. Library, Question Bank and Generate Quiz use the same compact buttons and 700 px responsive breakpoint as BQSearch's Lookup controls. They sit below the existing season, division and study-range context. The toolbar's BQ Search button returns to Lookup. Within the Library, collection and quiz back links still navigate their drill-down.

The current screen bodies and workflows are retained for this step. The Library displays the existing Saved Quizzes cards below the collection grid when saved quizzes exist. Legacy records display whichever metadata fields they contain. Saving from the Generator returns to the Library and focuses that section. The contextual overflow opens advanced catalog management, including installation and the current digest. When a catalog is unavailable, the control includes its text label. The quiz screens inherit the same light or dark palette as Lookup and Scorekeeper.

## Validation

| Check | Result |
| --- | --- |
| Unit tests and pack validation | 149 unit tests passed across 31 files. The approved Scripture pack passed validation. |
| Enabled production build and browser suite | 14 tests passed under `/BQSearch-Preview/`. Verified all four layouts, one global toolbar and theme, and host Lookup query and Scorekeeper team-name persistence. Both synthetic saved quiz orders and all five IndexedDB stores matched the before snapshot after navigation and reload. |
| Catalog and PWA | Verified automatic catalog loading, both collections, offline reload, SHA-256 rejection, manual fallback when the bundle is unavailable, and coexistence with existing local content. The existing single Workbox worker precaches the enabled quiz assets. |
| Disabled production build and browser | Production build under `/BQSearch/` emitted neither the quiz chunk, quiz navigation stylesheet nor catalog. The separate flag-off browser test confirmed the Quizzes entry is absent. |

Viewport checks used Chromium emulation. Native iPad Safari remains a later preview checkpoint. The commit is local because pushes to the integration branch would make it eligible for the scheduled public preview deployment.
