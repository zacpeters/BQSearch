# BQQuiz parity, Step 5 Generator

Generator work follows the restored Practice workspace at `7350d659bd9a1f08944063a266066078a49a88b4`. The original implementation was audited against the [standalone source ledger](original-source.sha256), including `GeneratorV5.tsx`, `features/generation/generator.ts`, and the source catalog.

## Layout and generation behavior

- The desktop view places setup, coverage, distribution and strategy at left. Collections, publishers, question types and the eligible pool appear at right. At 900 px and below, those groups flow into one column before Generate. The BQSearch toolbar, tabs and theme stay in place. The filter lists are bounded and scrollable, and question types open in a searchable disclosure.
- Balanced and random selection use the original V5 seeded shuffle and input ordering. Balanced selection encounters chapters in shuffled pool order and draws across those buckets. Both strategies select from the 10-, 20- and 30-point pools in that order and require the requested distribution. The default remains 8/9/3 and 350 possible points. A matching fixed-seed fixture was run against the original standalone module for both strategies, then used as the regression expectation.
- BQSearch keeps its active pack and division study-number coverage. Start and End remain editable and accept a pack option, study number or Scripture reference. Restricted mode requires every verse of each structured reference to resolve in range. Invalid or unavailable references exclude only the affected question. Unrestricted mode leaves reference metadata optional. New presets retain pack, season, division and study positions. Standalone V5 presets without scope metadata resolve by reference if both endpoints exist in the active division.
- Collection, source publisher and canonical question-type selections intersect. Clearing a group now gives an empty selection. Publisher choices come from source metadata, with the collection publisher used when the question lacks a publisher. Group counts, exclusion counts and point pools reflect the active filters.
- Generate shows a preview in selection order. Changing the configuration or source data invalidates that preview for saving. Regenerate uses its new seed immediately. Save commits the ordered question IDs and generating filters, then focuses Saved Quizzes in the Library. The saved item opens in V5 Practice and resolves its original question records by ID.

The earlier BQSearch sampler sorted candidates and chapter buckets before selection. Restoring V5 means a new selection with the same seed can differ from a selection made by that earlier sampler. Existing saved IDs, order, filters and sessions are left as stored. BQSearch also retains pack-scoped coverage, publisher and type controls, and a Library stop after saving. It requires at least one requested question so the saved quiz can open in Practice. The standalone V5 screen uses observed references for default coverage and starts Practice directly after saving.

## Classification audit

The 34 distinct raw catalog values, including unlabeled entries, map to 14 display labels. Canonical labels normalize known extraction breaks, punctuation, optional **Question** suffixes and equivalent modifier order. For example, `FO UR-PARTCROSSREFERENCEQUES TION` and `Cross - Reference Four Part` map to **Four-Part · Cross-Reference**. **Four-Part**, **Cross-Reference**, and **Four-Part · Cross-Reference** stay distinct, as do the three quotation variants. Unknown custom types stay independent. The canonical keys drive exact matching and leave raw catalog and user classification values intact.

| Display label | Published questions |
| --- | ---: |
| Direct (including unlabeled) | 336 |
| Quotation | 113 |
| Quotation Completion | 26 |
| Cross-Reference Quotation | 41 |
| Cross-Reference | 16 |
| Two-Part | 185 |
| Two-Part · Cross-Reference | 51 |
| Three-Part | 75 |
| Three-Part · Cross-Reference | 3 |
| Four-Part | 36 |
| Four-Part · Cross-Reference | 14 |
| Five-Part | 2 |
| Six-Part | 1 |
| Six-Part · Cross-Reference | 1 |

## Nine Lift Up records with empty structured references

The approved BQSearch catalog is byte-identical to the standalone JSON. All nine records already contain `references: []` there. In the original `scripts/extract-quizzes/import_2027.py`, `extract_catalog()` applies a rendered-page override to the answer, then populates the structured references from `references(block)`, which still sees the pre-override PDF text block. The citations below appear in the audited overrides and can be read by the original reference parser when it receives those overrides. The missing metadata comes from standalone extraction and survives unchanged in BQSearch.

| Published question ID | Source PDF page | Citation in the original review override |
| --- | ---: | --- |
| `lift-up-2027-quiz-01-q-12` | 1 | Psalms 5:8 |
| `lift-up-2027-quiz-06-q-02` | 11 | Psalms 4:6 |
| `lift-up-2027-quiz-08-q-02` | 15 | Psalms 18:12 |
| `lift-up-2027-quiz-08-q-08` | 15 | Psalms 18:18 |
| `lift-up-2027-quiz-13-q-08` | 25 | Psalms 18:35 |
| `lift-up-2027-quiz-15-q-10` | 29 | Psalms 11:4 and 11:5 |
| `lift-up-2027-quiz-19-q-05` | 37 | Psalms 18:8 |
| `lift-up-2027-quiz-19-q-08` | 37 | Psalms 18:35 |
| `lift-up-2027-quiz-20-q-06` | 39 | Psalms 18:12 |

Excluding these records is correct for strict mode given the approved structured metadata. The default Intermediate pool is 891 of 900. All nine remain available in the Question Bank and in unrestricted generation when they match the other filters. This change leaves the catalog, original source, and reference metadata intact.

## Validation

| Viewport | Generator layout |
| --- | --- |
| Desktop, 1440 px | [Screenshot](screenshots/generator-desktop.png) |
| iPad portrait, 810 px | [Screenshot](screenshots/generator-ipad.png) |
| iPad landscape, 1080 px | [Screenshot](screenshots/generator-ipad-landscape.png) |
| Phone, 390 px | [Screenshot](screenshots/generator-phone.png) |

Chromium tests checked the grid, control bounds, horizontal overflow and pointer access to Generate below the toolbar in each viewport. The same four profiles exercised exact type filtering, collection/publisher intersection, shortage reporting, new and standalone coverage presets, custom distribution, user-content generation, saved IDs and order, and the Library-to-Practice flow. Layout coverage uses Chromium emulation for tablets and phones.

All 157 unit tests, 28 feature-enabled browser tests and the feature-disabled browser test passed. Pack validation and the feature-enabled, feature-disabled and admin production builds passed. The `/BQSearch-Preview/` build precaches the verified catalog and quiz assets through the host service worker. The feature-disabled `/BQSearch/` build excludes the catalog and quiz assets.

## Coverage and navigation follow-up

- Start and End use one native selector each, populated from the active division's actual verses. This removes the competing typed-and-Browse controls that made range selection unreliable. Reversed ranges show an explanation and block generation while the range restriction is active.
- BQSearch records the current screen in the URL. Reload and browser Back and Forward restore quiz tabs, collection drill-down, and published or saved Practice. Practice resolves the original question IDs in order and opens existing session data.
- The Generator keeps its draft in the current browser tab, scoped to the active pack, division and Lookup study range. It restores the range, title, filters, and selection strategy. A generated preview is restored when the same seeded selection reproduces its ordered IDs and question revisions. Saving still writes the quiz through the existing IndexedDB path.
- Browser coverage exercises verse browsing, shorthand entry, reversed ranges, reload, and Back and Forward in all four viewport profiles. Separate checks restore the Generator preview offline and reopen an in-progress Practice session with the same recorded attempts.
- The generated preview now offers **Start quiz** for immediate V5 Practice and **Save for later** as an optional persistence action. Question types remain visible in the Generator with search, Select all, Clear all, and selected-count feedback.
- Question Bank entry now keeps collection selection central, offers Create collection directly beside the question form, uses a canonical question-type dropdown, and provides a multi-select Scripture picker populated from the active division. Existing raw references remain preserved when an older question cannot be mapped to the picker.
