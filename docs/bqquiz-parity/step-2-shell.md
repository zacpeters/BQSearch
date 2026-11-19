# BQQuiz parity migration, Steps 1 and 2

The shell is ready for local review on `feature/bqquiz-integration`. The screen migration begins at Step 3.

## Baseline and scope

- **BQSearch base revision** `df44d353750824d6ae3eebd4ee24661d89f43d88`.
- **Original BQQuiz source** `/Users/zacpeters/Documents/Development/BQQuiz`. This directory has no Git metadata, so the [SHA-256 ledger](original-source.sha256) pins the active V5 source, catalog, dependency lockfile and exact build used for screenshots. All 21 hashes were checked against the original directory. The bundled catalog still matches the approved source byte for byte.
- **Synthetic storage fixtures** [BQQuiz and BQSearch record shapes](../../tests/fixtures/bqquiz-parity-storage.json). The two sets cover user collections and questions, coverage presets and saved quizzes, plus an original-style pending-reread session. Saved quiz arrays deliberately put Question 2 before Question 1. The browser tests compare the full five-store snapshot before and after shell navigation.
- **Differences to track separately** [original V5 defects](v5-known-defects.md). Future Practice reads will use the active division's full Scripture coverage and the saved quiz's exact question order. Full five-store transfer belongs to a later step.

## Shell comparison

| Viewport | Original V5 | Embedded Step 2 |
| --- | --- | --- |
| Desktop, 1440 px | [Library](screenshots/original-desktop-library.png) | [Light](screenshots/embedded-desktop-light.png) · [Dark](screenshots/embedded-desktop-dark.png) |
| iPad portrait, 810 px | [Library](screenshots/original-ipad-library.png) | [Light](screenshots/embedded-ipad-light.png) · [Dark](screenshots/embedded-ipad-dark.png) |
| iPad landscape, 1080 px | [Library](screenshots/original-ipad-landscape-library.png) | [Light](screenshots/embedded-ipad-landscape-light.png) · [Dark](screenshots/embedded-ipad-landscape-dark.png) |
| Phone, 390 px | [Library](screenshots/original-phone-library.png) | [Light](screenshots/embedded-phone-light.png) · [Dark](screenshots/embedded-phone-dark.png) |

Original desktop references for later steps are [dark mode](screenshots/original-desktop-dark.png), [Question Bank](screenshots/original-desktop-question-bank.png), [Generator](screenshots/original-desktop-generator.png), [Saved quizzes](screenshots/original-desktop-saved.png) and [Practice](screenshots/original-desktop-practice.png). Captures use fresh Chromium contexts. The original Saved and Practice examples came from a newly generated quiz in the disposable browser context.

The embedded app uses the original 76 px header, its three tabs, brand, theme toggle, offline indicator, footer, and 850 px breakpoint. Its header sticks below the 52 px BQSearch toolbar. The BQSearch context bar still shows the active division and study range. The original theme variables are contained inside the quiz root and drive the colors of the current screen bodies during the interim stage. This step ports the shell rules from both original stylesheets. Component-specific CSS will follow with the original components.

The current Library cards, Question Bank, Generator, and saved-quiz screen remain in use. Saved Quizzes is reachable through a secondary control in the Library and through the current Generator's save action. Catalog version and digest appear under Advanced catalog options. Practice remains outside this step.

## Validation

| Check | Result |
| --- | --- |
| Unit tests and pack validation | 149 unit tests passed across 31 files. The approved Scripture pack passed validation. |
| Enabled production build and browser suite | 14 tests passed under `/BQSearch-Preview/`. Verified all four layouts, light/dark isolation, the sticky quiz header, and host Lookup query and Scorekeeper team-name persistence. Both synthetic saved quiz orders and all five IndexedDB stores matched the before snapshot. |
| Catalog and PWA | Verified automatic catalog loading, both collections, offline reload, SHA-256 rejection, manual fallback when the bundle is unavailable, and coexistence with existing local content. The existing single Workbox worker precaches the enabled quiz assets. |
| Disabled production build and browser | Production build under `/BQSearch/` emitted neither the quiz chunk, shell stylesheet nor catalog. The separate flag-off browser test confirmed the Quizzes entry is absent. |

Viewport checks used Chromium emulation. Native iPad Safari remains a later preview checkpoint. The commit is local because pushes to the integration branch would make it eligible for the scheduled public preview deployment.
