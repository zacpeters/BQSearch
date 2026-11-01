# BQLookup Enhancement Roadmap

This roadmap follows the current architecture and keeps public lookup offline and local-only. Each phase is independently testable. No phase authorizes deployment or publication of unreviewed Scripture material.

## Phase 1: Lookup usability and reference searching

Deliver:

- visible Help/syntax affordance;
- rename the settings entry from Tournament to Settings and add an explicit Back to Lookup action;
- derive range defaults and full-range labels from the active pack maximum;
- normalize canonical names, singular/plural forms, and documented aliases;
- parse compact forms such as `ps8.3` and `psa8 3`;
- resolve bare chapter/verse forms only when unambiguous, otherwise show candidates;
- retain reference order and active division/range filtering.

Test gate: every supplied reference form, ambiguity case, pack maximum, division, and empty result is covered; public tests prove no network request occurs.

## Phase 2: Coaching-oriented search improvements

Deliver:

- exact token matching separate from substring matching;
- total occurrence and distinct-verse counts;
- exact 1x/2x/3x filters and abbreviated occurrence references;
- explicit phrase, starts-with, and ends-with modes;
- punctuation-aware normalization;
- previous/next biblical verse navigation and optional chapter context;
- related-result grouping and a compact comparison view.

Test gate: frequency totals differ correctly from distinct verse totals; adjacency crosses chapters correctly; study-number adjacency is never treated as biblical adjacency.

## Phase 3: Formatting preferences

Deliver:

- public toggles for formatting and individual categories;
- local style preferences with light/dark-compatible colors;
- preview, single-category reset, and reset-all behavior;
- touch-safe controls and keyboard-accessible settings.

Test gate: preferences survive reload/offline use, reset to administrator defaults, and do not alter source text or search results.

## Phase 4: Scripture analyzer

Deliver:

- deterministic division-wide tokenization and frequency indexes;
- unique beginning/ending analysis;
- versioned annotation schema with token/character offsets;
- analyzer/cache checksums and compatibility checks;
- local Material Manager review of generated annotations.

Test gate: analyzer output is deterministic, independent of visible range, division-specific, and stable under pack round trips.

## Phase 5: Semantic categories and admin review

Deliver:

- versioned dictionaries for animals, body parts, locations, and proper names;
- punctuation classification;
- ambiguity warnings and manual corrections;
- review status and audit trail;
- approved annotation export without modifying KJV source text.

Test gate: incomplete or rejected required annotations block official export; manual corrections survive re-analysis and cache refresh; public lookup uses only approved static data.

## Phase 6: End-to-end validation

Deliver:

- offline application-shell and installed-pack tests;
- division switching and range-boundary regression suite;
- full-season performance checks on desktop, iPad, and iPhone viewport fixtures;
- Junior/Intermediate/Experienced coaching scenario suite;
- pack compatibility, checksum, rollback, and upgrade tests;
- documentation and maintainer review checklist.

Test gate: all automated tests pass with network disabled, pack validation passes, and a human tournament rehearsal completes the reference, quotation, count, context, and comparison workflows.

## Architectural concerns to resolve before later phases

1. Define how division-specific study numbers are projected into the public verse model; the current primary `studyNumber` path is insufficient for all overlapping-divisions cases.
2. Decide whether annotations are embedded in packs or shipped as checksum-bound companion files.
3. Define tokenization and unique-prefix/suffix rules before generating official annotation data.
4. Establish dictionary ownership, versioning, and review policy for semantic categories.
5. Add storage migrations before changing IndexedDB schemas.

## Decisions requiring owner approval

- Which reference shorthand forms are officially supported, and how should ambiguous bare references be displayed?
- Should fuzzy spelling suggestions be included, and what maximum edit distance is acceptable?
- Should context/compare tools be inline on mobile and split-pane on desktop, or use one responsive component?
- Which annotation categories are required for an approved pack?
- Are administrator defaults authoritative for public formatting, or may users opt into experimental categories?
- Should search history/pinned comparison sets be persisted locally?

## Non-goals

This roadmap does not add public authentication, runtime Scripture APIs, semantic cloud search, automatic pack publishing, or changes to the KJV text. Material retrieval and publication authorization remain maintainer-side workflows.

