# Phase 3A Scripture Analysis Engine

## Scope

Phase 3A adds deterministic, local analysis without changing Scripture text, public pack schemas, or the public renderer. The shared engine is `src/analysis.ts`; the Material Manager invokes it for the selected prepared division and exports a separate JSON report.

## Boundary analysis

Unique beginnings and endings are calculated over the complete projected division, independent of the visible study range. Scripture is tokenized by the existing `src/tokenize.ts` tokenizer. Prefixes are compared from the beginning; suffixes are compared backward from the end. The shortest sequence whose normalized token key occurs once is selected. A verse that is a complete prefix or suffix of another remains unresolved unless a longer sequence actually distinguishes it. Empty text and identical boundaries are reported as unresolved.

Boundary spans use UTF-16 code-unit offsets into the original verse string. The phrase is obtained by slicing the original text, so punctuation and capitalization are preserved.

## Frequency annotations

`analyzeWordFrequencies()` remains the source of truth. Total occurrences are counted across the entire projected division, including repeated occurrences in one verse. Words with totals 1, 2, and 3 produce `frequency-1`, `frequency-2`, and `frequency-3` annotations. Four or more occurrences produce no frequency annotation. Each occurrence retains tokenizer offsets and includes deterministic cross-reference metadata.

## Annotation contract

Annotations are independent records with an identifier, type, verse ID, division, UTF-16 `start`/`end`, exact original-text `value`, `normalizedValue` used for matching, analysis source, and analysis version. The invariant `value === verse.text.slice(start, end)` is validated. Frequency and boundary annotations may overlap. No HTML or markup is stored, and the source Scripture string is never modified. Analysis version 1.1 records this distinction.

## Deterministic reports

`AnalysisReport` contains the analysis version, source pack identity/checksum when available, division, configuration, summary, boundary findings, annotations, unresolved cases, warnings, and errors. Arrays are ordered deterministically and reports do not contain timestamps or random identifiers. `analysisJson()` serializes the report for local review or archival use.

## Material Manager workflow

After importing and reviewing material, the local Material Manager provides **Run local analysis**. It analyzes only rows with the selected division, displays counts and unresolved cases, reports missing/retrieval issues, and provides **Export analysis JSON**. This report is separate from pack export and is not automatically attached to public packs or stored in IndexedDB.

## Validation and limitations

Report validation checks duplicate annotation IDs, empty/out-of-range spans, and missing verse IDs when the analyzed verse collection is supplied. Phase 3A does not render annotations, detect semantic categories, or alter public search behavior. The next phase can add a safe renderer and administrator-configurable formatting while continuing to preserve original Scripture text.
