# BQLookup Coaching Workflow Audit

## Scope and method

This is a read-only audit of the current standalone BQLookup repository. It covers the public lookup application, search parser, pack and material schemas, IndexedDB persistence, offline shell, local Material Manager, tests, and documentation. No application code or Scripture data was changed for this audit.

The repository does not contain the sample Junior or Senior question-set PDFs described in the request. The workflow assessment therefore uses the supplied scenarios and the implementation as evidence; it does not claim direct analysis of those source PDFs.

## Executive assessment

BQLookup already has a strong offline foundation: published packs are static JSON, public search executes locally, packs and settings persist in IndexedDB, the application has a PWA shell, and the local Material Manager keeps retrieval and publishing preparation separate from public lookup. The current public experience is also compact and search-first, with keyboard shortcuts, highlighted matches, and copy actions.

The largest coaching gap is search intent coverage rather than storage or retrieval. Explicit references in the currently supported syntax and ordinary word/phrase searches work, but flexible reference forms, precise word semantics, occurrence metrics, verse relationships, and category-aware questions are not yet implemented. The current interface exposes study-range controls but does not yet provide the contextual tools coaches use after finding a verse.

## Current architecture and behavior

### Public lookup

`src/App.tsx` loads an installed pack and tournament settings from `src/storage.ts`, filters verses by division and study range, and passes the filtered list to `src/search.ts`. The search view is the default view. Results are compact rows containing study number, reference, text, and copy-reference/copy-text actions. Matching terms are highlighted.

The public app does not call the Scripture API. It searches the locally installed pack and remains usable without an account or network connection once the application shell and pack are available locally.

### Search engine

`src/search.ts` supports reference, study-number, phrase, word, all-word, and verse-start modes. It normalizes case and some quotation marks, but its reference parser is deliberately narrow. Word and phrase matching are substring-based and return matching verses; they do not calculate token frequencies or total occurrence counts.

### Material and pack model

`src/types.ts` defines versioned pack, season, division, verse, and tournament-setting types. Study numbers are represented independently from biblical references in the material import path. `src/material/importer.ts` assigns sequential numbers to ordered plain-text imports and preserves explicit CSV/JSON numbers. `src/material/pack.ts` validates required text and metadata, produces checksums, and verifies pack integrity.

One important limitation remains: the public verse model has a primary `studyNumber` and optional `studyNumbers`, but the public filtering/search path uses the primary number. A pack that gives the same biblical verse different numbers in different divisions needs a clearly defined public projection or per-division number lookup before all independent numbering cases are fully safe.

### Persistence and offline support

`src/storage.ts` stores packs and settings in IndexedDB. The Vite/PWA build supplies an application shell and the public app can use installed static packs without runtime API calls. Pack discovery/download and local installation are separate from lookup. The current persistence layer has no migration framework and no public pack-management history UI; those are future robustness concerns rather than blockers for the current lookup flow.

### Local Material Manager

`src/material-manager/AdminApp.tsx` is a local preparation tool. It imports TXT/CSV/JSON/reference lists, exposes season and division selectors, retrieves KJV text through the preparation-time adapter, supports local corpus fallback and manual corrections, reviews validation issues, and exports versioned packs. It is not public authentication and it does not expose publishing authorization. The public app does not depend on it at runtime.

## Coaching scenario findings

### A. Reference lookup

`Psalms 8:3` works when that verse is present in the active filtered pack. `Ps 8:3` works through the current alias table. `Psalm 8:3`, `ps8.3`, `psa8 3`, `8:3`, `8.3`, and `8 3` are not reliably parsed by the current reference parser. Bare chapter/verse forms are not attempted, so they cannot currently produce an ambiguity-aware result list.

The confirmed issue is not that reference lookup is absent; it is that normalization and ambiguity handling do not cover the coaching shorthand. The recommended behavior is to normalize common book aliases and compact forms, then return candidate references for ambiguous chapter/verse input rather than silently selecting one.

### B. Quotation and partial-phrase lookup

Quoted exact phrases and ordinary multiword searches generally work for case and common quotation-mark differences. Multiword searches are treated as an AND query, so words can be supplied out of order. Phrases in the middle of a verse can be found.

Verse beginnings are supported through the `start:` prefix or a trailing `*`, although the UI does not make that syntax obvious. Verse endings are not a first-class mode. Minor spelling mistakes are not tolerated. Punctuation normalization is partial because matching is primarily normalized string containment, not a shared tokenization model.

### C. Unique and repeated words

A single-word query returns verses containing a substring. It does not report total occurrences, distinct verse count, repeated occurrences within one verse, or references for each occurrence. It also does not enforce whole-word matching, so exact word questions can produce false positives from substrings.

This is a confirmed capability gap for questions such as “exactly twice,” “how many verses,” and “how many total times.”

### D. Cross-reference questions

An AND query can locate verses containing all supplied terms. It cannot present a cross-reference set, compare matching phrases side by side, identify shared beginnings/endings, or rank consecutive related verses. These workflows need result grouping and lightweight relationship tools, not necessarily semantic or AI search.

### E. Verse relationships

The current result action scrolls to a selected result. There is no previous/next verse control, chapter context, adjacent-verse display, or relationship navigation. Study numbers must not be used as a substitute for biblical adjacency; the future navigation model should resolve actual book/chapter/verse neighbors and indicate when a neighbor is outside the installed study coverage.

### F. Question-based lookup

Literal text questions can sometimes be answered with ordinary word or phrase search. Questions about animals, body parts, places, names, exact frequency, punctuation, and semantic categories do not have structured support. They require deterministic pack annotations and an administrator review workflow. No runtime external API or AI service is necessary for the proposed design.

## Interface audit

The current application is search-first and compact, which is appropriate for tournament use. It has keyboard focus behavior (`Cmd/Ctrl+K`, Escape, arrow selection, Enter-to-scroll), copy actions, light/dark theme support, and visible season/division/range controls.

Confirmed usability issues and limitations:

1. There is no obvious Help button or in-app syntax guidance.
2. A full range is represented as `∞` when the internal upper bound is 999; this is technically compact but not self-explanatory.
3. “Tournament” is the toolbar label for the settings view; “Settings” would be clearer.
4. Range controls use 1 and 999 rather than the selected pack’s actual maximum study number.
5. The settings view can return through the toolbar, but there is no explicit “Back to Lookup” control.
6. Reference aliases and compact forms are incomplete.
7. Reference-only searches are reliable only for the supported full-form syntax.
8. Study numbers remain useful metadata, but study-number search is more specialized than reference/word search and should not compete visually with the primary search affordance.

## Recommended direction

Prioritize reference normalization and ambiguity-aware results, then add coach-oriented counts and related-verse navigation. Add formatting and semantic annotations only after the search contract and pack compatibility rules are stable. Preserve the current local-only public architecture and keep analysis/import/publishing concerns in the local Material Manager.

