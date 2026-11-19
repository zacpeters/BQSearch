# BQQuiz parity migration, Step 3

The V5 Library and Question Bank run inside the unified BQSearch workspace. The approved Step 2 revision is `4cc9711bf6ab8080704153c3203357b383e9cf94`. The [original source ledger](original-source.sha256) identifies the standalone V5 build and components used for comparison.

## Restored workflows

- **Library** uses the V5 search, collection cards, counts, observed Scripture coverage and numbered quiz lists. Saved Quizzes appears below the collection grid. Where the local database has published-quiz sessions, the Library shows the five most recent as in V5.
- **Question Bank** uses the V5 question-first rows, search by question, answer or reference, collection filter and point counts. Expanding a row shows its answer, references, classification and Preview. Users can create and manage their own collections, edit publisher and year, and add, edit, duplicate or delete their own questions. Collection deletion checks for dependent saved quizzes.
- **Import and export** use the V5 count and point-value preview, CSV support and schema-1 user-content JSON. Existing backup envelopes can supply their collection and question records with a warning about the other stores. The contextual overflow still offers the verified manual catalog installer and a separate download of the existing five-store backup.
- **Storage and publication** use the current IndexedDB schema and verified catalog. Imports skip existing or published IDs and reject missing user collections. The two-store import transaction rolls back if a conflicting write or a removed collection is detected. Legacy records that collide with published content stay in storage, and the published Bank entries remain read-only.

## Differences from standalone V5

| Area | Step 3 behavior |
| --- | --- |
| Layout and theme | The original component styles apply inside BQSearch's narrower workspace with its global colors and contextual tabs. The V5 card grids and 850 px breakpoint are retained. The standalone header and footer are absent. |
| Opening quizzes | Published and saved quizzes open the existing read-only detail viewer. Saved questions are resolved by stored IDs and keep their positions. Missing or ambiguous IDs are reported rather than substituted. Starting or resuming a Practice session remains a later step. |
| Saved quiz actions | The V5 saved rows include a small overflow for BQSearch's existing rename, duplicate and delete actions. Generator still uses the current save path and focuses the Library's Saved Quizzes section. |
| Bank reference handling | References show verse ranges. The editor accepts supported books beyond Psalms and preserves the existing reference objects when the field is unchanged. Invalid references produce feedback. Integration-only Bank filters and pack-status chips have been removed in favor of the original V5 filter layout. |
| Import compatibility | Original CSV fields are accepted alongside the existing BQSearch columns. CSV rows without an external ID receive a new local ID, as in V5. JSON IDs are preserved. The five-store backup download remains available, and full restore is outside this step. |

## Screenshots

Captured from the pinned original and the local Step 3 build using Chromium at the same viewport sizes. The integrated captures use synthetic collections and saved quizzes to exercise existing-data states.

| Viewport | Collections | Collection drill-down | Question Bank |
| --- | --- | --- | --- |
| Desktop, 1440 px | [Original](screenshots/original-desktop-library.png) · [Step 3](screenshots/step3-desktop-library.png) | [Original](screenshots/step3-original-desktop-drilldown.png) · [Step 3](screenshots/step3-desktop-drilldown.png) | [Original](screenshots/original-desktop-question-bank.png) · [Step 3](screenshots/step3-desktop-question-bank.png) |
| iPad portrait, 810 px | [Original](screenshots/original-ipad-library.png) · [Step 3](screenshots/step3-ipad-library.png) | [Original](screenshots/step3-original-ipad-drilldown.png) · [Step 3](screenshots/step3-ipad-drilldown.png) | [Original](screenshots/step3-original-ipad-question-bank.png) · [Step 3](screenshots/step3-ipad-question-bank.png) |
| iPad landscape, 1080 px | [Original](screenshots/original-ipad-landscape-library.png) · [Step 3](screenshots/step3-ipad-landscape-library.png) | [Original](screenshots/step3-original-ipad-landscape-drilldown.png) · [Step 3](screenshots/step3-ipad-landscape-drilldown.png) | [Original](screenshots/step3-original-ipad-landscape-question-bank.png) · [Step 3](screenshots/step3-ipad-landscape-question-bank.png) |
| Phone, 390 px | [Original](screenshots/original-phone-library.png) · [Step 3](screenshots/step3-phone-library.png) | [Original](screenshots/step3-original-phone-drilldown.png) · [Step 3](screenshots/step3-phone-drilldown.png) | [Original](screenshots/step3-original-phone-question-bank.png) · [Step 3](screenshots/step3-phone-question-bank.png) |

[Desktop Library in global dark mode](screenshots/step3-desktop-dark.png)

## Validation

- 151 unit tests passed across 32 files. Pack validation passed.
- 16 enabled browser tests and the flag-off browser test passed. Coverage includes all four viewports, catalog integrity and manual fallback, offline reload, V5 collection and question workflows, saved question order and regression checks for Lookup and Scorekeeper.
- Both seeded record shapes and every record in all five stores matched their before snapshots after navigation and reload. The simulated conflicting import also rolled back without modifying previously stored records.
- Enabled, disabled, and Material Manager production builds passed. The approved 2027 catalog matched the original bytes and the current Workbox worker precached the enabled quiz assets.

Generator and Practice migration remain pending. This commit is local and the original BQQuiz sources are unchanged.
