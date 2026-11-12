# Search vocabulary audit — November 11, 2026

Audited every word in every shipped JSON material pack, using independently extracted source-text expectations and each division's public search projection. The audit runs as part of `npm test` in `src/search.audit.test.ts`; newly shipped JSON packs are included automatically.

| Division | Verses | Distinct words | Checks |
| --- | ---: | ---: | ---: |
| Beginner | 192 | 739 | 2,956 |
| Junior | 288 | 958 | 3,832 |
| Intermediate | 429 | 1,204 | 4,816 |
| Experienced | 530 | 1,348 | 5,392 |
| Total | | | 16,996 |

Each word is checked against the complete expected verse ID list in ordinary substring search, and exact token search using lowercase, uppercase, and surrounding spaces. Exact comparisons reject both missing and extra verses. All checks pass after the fixes.

## Findings and corrections

- The reference classifier used unrestricted book-alias prefix matching. For example, `hearken` began with `he` (Hebrews) and was classified as an unfinished reference, suppressing results. Ordinary words now remain text searches; reference-shaped numeric input retains reference handling.
- Bare book names and aliases can themselves be words, including `he`, `mark`, and `John`. They now support word searches. Adding chapter/verse numbers selects reference search. Explicit reference lists still report bare book names as incomplete.
- Search normalization removed internal straight apostrophes, making Exact Word lookup disagree with Scripture tokens such as `Lord's`. Internal apostrophes are now preserved.
- `hearken` is present in Psalms 5:2, 34:11, and 103:20. Results remain subject to the selected division and study range.

This audit verifies retrieval against shipped material, not the completeness or accuracy of the material against an external Bible source. Existing reference, operator, range, and UI tests continue to cover their respective behavior.

Validation: vocabulary audit, full application test suite, production build, and material-pack validation passed.
