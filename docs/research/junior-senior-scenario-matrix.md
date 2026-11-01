# Junior, Intermediate, and Experienced Scenario Matrix

## Evidence note

No sample Junior or Senior question-set PDFs are present in the repository, so this matrix is based on the supplied scenario descriptions and the current code. It does not reproduce or embed copyrighted question-set content.

The division names in the current material importer are Beginner, Junior, Intermediate, and Experienced. The public type definitions also retain legacy Juniors/Seniors values for compatibility, with importer mappings documented in `src/material/books.ts`.

## Scenario comparison

| Coaching task | Junior likelihood | Intermediate likelihood | Experienced likelihood | Current BQLookup fit | Recommended capability |
|---|---:|---:|---:|---|---|
| Direct reference lookup | High | High | High | Partial: full supported references work; shorthand is incomplete. | Alias normalization and ambiguity-aware reference candidates. |
| Locate a verse from a quotation | High | High | High | Partial: exact/AND phrase search works; endings and typo tolerance do not. | Phrase, beginning, ending, and token-aware matching. |
| Unique-word question | High | High | High | Partial: matching rows only, no exact-word or frequency metrics. | Whole-token search plus count summaries. |
| “How many verses contain…” | Medium | High | High | Missing as a count operation. | Distinct verse and total occurrence counts. |
| Two- or three-verse cross-reference | Medium | High | High | Partial only when terms co-occur in one verse. | Related-result groups and side-by-side comparison. |
| Consecutive verses sharing a word | Medium | High | High | Missing. | Biblical-neighbor traversal and run detection. |
| Quotation of preceding/following verse | Medium | High | High | Missing context navigation. | Previous/next actions with coverage warnings. |
| Compare phrase beginnings/endings | Medium | High | High | Missing ending mode and comparison view. | Prefix/suffix search and grouped comparison. |
| Multi-part question workflow | High | High | High | Search can answer separate literal parts, but does not preserve a working set. | Search history/pinned results or a lightweight comparison set. |
| Animal/body-part/location/name question | Medium | Medium | High | Missing structured categories. | Reviewed dictionary annotations. |
| Exact twice/three times question | Medium | High | High | Missing. | Division-wide frequency index with occurrence references. |
| Punctuation question/exclamation | Low | Medium | High | Missing structured punctuation search. | Punctuation annotations and filters. |

## Workflow implications

Junior coaching benefits most from fast reference normalization, quotation lookup, visible study metadata, and simple count summaries. Intermediate coaching begins to benefit materially from related verses, frequency metrics, and actual Scripture adjacency. Experienced coaching places the greatest demand on comparison, prefix/suffix analysis, context navigation, and reviewed semantic/punctuation annotations.

These are tendencies, not exclusive division rules. The same features should be available across divisions, with results constrained by the selected division and study coverage.

## Suggested acceptance fixtures

Create a small synthetic fixture per division containing:

- an exact reference and common aliases;
- a phrase at the beginning, middle, and end of verses;
- a word repeated twice in one verse and once in another;
- adjacent verses sharing a word;
- a chapter boundary;
- a category word with an intentionally ambiguous proper name/location;
- distinct study sequences for at least two divisions.

Then run the same scenario suite against every division. This prevents Junior-specific improvements from accidentally depending on Senior terminology or shared study numbers.

