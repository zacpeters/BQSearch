# BQ Search Verse Context Resolution

Phase 2B context is resolved by `resolveSurroundingContext()` in `src/relationships.ts` over the active division-specific projected verses.

## Rules

- Adjacency uses the same book, chapter, and verse fields as Scripture references.
- Study numbers are display metadata only and never determine adjacency.
- A context step requires the exact next or previous biblical reference to be present in the installed active-division material.
- If that exact reference is missing, expansion stops in that direction; later verses are not presented as consecutive.
- Context uses the full active division projection, so a verse outside the selected study range may be inspected and is labeled accordingly.
- Context is not included in search result counts, frequency totals, selected-range filtering, or comparison state.
- Context state is local component state and is not persisted.

## Chapter boundaries

The current pack schema does not include authoritative chapter-length metadata, and the public app cannot retrieve missing Scripture at runtime. Therefore context does not infer that the highest verse present in a partial pack is the final verse of a chapter. Chapter-boundary context is shown only when the exact adjacent reference is present and can be established from installed material. This conservative behavior avoids skipping missing verses or presenting an unsafe boundary jump.

