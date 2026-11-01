# BQ Search Tokenization and Frequency Contract

Phase 2A adds pure local utilities in `src/tokenize.ts` and `src/frequency.ts`. They do not change Scripture text, pack schemas, checksums, or IndexedDB storage.

## Tokenization policy

- Matching is case-insensitive using `toLocaleLowerCase()`.
- Tokens contain Unicode letters and numbers.
- Surrounding Unicode punctuation is ignored because it is not part of a token.
- An internal ASCII or curly apostrophe remains part of a token, so `heaven's` is one word.
- Hyphens separate tokens, so `well-known` becomes `well` and `known`.
- Word forms are not stemmed or lemmatized. `love`, `lovely`, `sin`, and `sinners` remain distinct.
- Each token retains its original surface text, zero-based token index, and UTF-16 `start`/`end` offsets for future annotation rendering.

## Frequency contract

`analyzeWordFrequencies()` accepts the complete division-specific projected verse collection. It returns a `Map` keyed by normalized word. Each entry contains:

- total token occurrences;
- distinct verse count;
- deterministic references ordered by study number, then canonical reference fields;
- every occurrence’s text, offsets, token index, reference, and division-specific study number.

The analyzer must receive the full division, not the current visible study range. The UI may analyze the selected range separately to report current results, but it must never replace the division totals with those range totals.

## Exact Word search

The public lookup keeps the existing substring word search as the default. The **Exact word** control enables whole-token matching for a single word. Exact searches use the same active division projection and selected study range as all other public searches. Phrase, reference, study-number, and verse-start modes retain their existing behavior.

The analyzer is memoized in the public component by the projected division collection. It is not persisted because it is deterministic and inexpensive to regenerate from the installed pack; a future performance change may cache it by pack identity, division, and analyzer version without changing the pack schema.

