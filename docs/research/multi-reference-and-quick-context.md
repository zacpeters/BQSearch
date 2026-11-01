# BQ Search Multi-Reference and Quick Context Contract

## Multi-reference search

Semicolons and commas split a query into independent reference segments. Each segment is parsed with the existing reference parser, evaluated against the complete projected division, and then filtered to the selected study range. Results are emitted in segment order, with duplicate verse IDs removed at their first occurrence. Invalid or incomplete segments do not invalidate completed segments; `ReferenceSegmentFeedback` reports matched, range-only, missing, incomplete, or invalid status for each segment.

Comma lists may use same-chapter shorthand after a complete reference, for example `Ps 3:2,4,6` or `Ps 3:2,4-6`. Commas inside a quoted phrase are not separators. A comma-separated input is treated as a reference list only when at least one segment is a recognizable reference; otherwise ordinary text/phrase search remains unchanged.

Simple two-word Boolean operators are supported as `faith AND works` and `faith OR hope`. Operands use exact whole-word token matching, operators are case-insensitive, and quoted operator words remain part of a phrase. Incomplete or malformed operator expressions show an incomplete-search state rather than falling back to substring matching.

Context is never used to fill a search result. A result count describes only verses matched by the entered segments.

## Quick Context

The former global context preference is no longer shown. Its optional `contextMode` field remains readable for IndexedDB compatibility, but is ignored; no migration or data deletion is required. Every result starts collapsed, and its session-only expansion state is controlled by a compact `+` / `−` button.

Quick Context uses `resolveSurroundingContext()` over the active division projection, not the selected study-range subset. It follows only exact adjacent book/chapter/verse references present in the installed material. Missing immediate verses stop expansion; later available verses are not presented as consecutive. Context verses outside the selected range are labeled and do not affect search counts, frequency statistics, comparison state, or saved range settings.

The existing inline detail panel remains available for full verse actions and navigation. Quick Context is an independent result-level affordance so opening detail is not required to inspect nearby installed verses. When several results are expanded, each renders its own deterministic context block; context blocks are not merged.

