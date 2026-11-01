# Scripture Annotation Rendering

## Sidecar architecture

Analysis remains separate from Scripture packs. The public app looks for a division-specific sidecar at:

`analysis/{packId}/{division}.json`

The URL is resolved with Vite's `import.meta.env.BASE_URL`, so a GitHub Pages build requests paths such as `/BQSearch/analysis/season-2027-v1/Beginner.json`. Static sidecars are same-origin assets and participate in the PWA's normal asset/offline strategy when they are present at build time. No external API is used.

The loader accepts analysis schema version `1.1` only. It verifies the report division, pack ID, pack version, optional pack integrity checksum, annotation verse IDs, division membership, normalized value presence, and UTF-16 offsets. A missing sidecar reports **Not installed**; malformed, unsupported, or mismatched reports are rejected and never partially rendered.

No analysis sidecars are currently included in `public/`. Until maintainers add reviewed reports under the documented directory, lookup remains ordinary unannotated Scripture.

## Rendering rules

`AnnotatedVerse` segments the original Scripture string at all annotation and search-match boundaries. It renders the original text slices directly; it never reconstructs text from normalized values and never uses `dangerouslySetInnerHTML`.

- Unique beginnings are bold/underlined and receive a visual `/` marker at the annotation end.
- Unique endings are bold/underlined and receive a visual `\` marker at the annotation start.
- Frequency 1, 2, and 3 annotations use accessible blue, green, and red text colors.
- Four-or-more words have no frequency annotation.
- Existing search matches receive the current search highlight.

Overlapping annotations are represented by one deterministic segmentation. Compatible classes are composed on each segment, so a frequency word inside a boundary remains both colored and underlined/bold. Markers are separate `aria-hidden` elements and do not alter source offsets or stored Scripture text.

## Preferences

The **Color Coding** control provides independent toggles for unique beginnings, unique endings, and frequency 1/2/3. Preferences are stored in localStorage under `bq-search-study-markings-v1`. Malformed values fall back to defaults. Preferences are local-only and do not change IndexedDB identity or pack data.

The report is computed against the complete active division. Selected study ranges only filter search results; they do not change annotation calculations. Context verses use the same validated division report when available.

## Adding reports

Export a reviewed Phase 3A analysis JSON from the local Material Manager, then place it in the repository's static asset directory as:

`public/analysis/<pack-id>/<division>.json`

The report's `sourcePack.id`, `sourcePack.version`, and optional `sourcePack.checksum` must match the installed pack. Keep reports reviewed and version-controlled with the corresponding static pack. Do not attach them to the Scripture pack JSON or publish them through the public app's UI.

## Limitations and next phase

This phase does not implement semantic categories, cross-reference popovers, or annotation editing. The current Material Manager exposes availability, summary, and unresolved-case review through the existing local workflow. Phase 3B.2 can extend review and packaging workflows after approval; public semantic formatting remains intentionally out of scope.

## Presentation configuration

Material Manager exposes a declarative presentation editor for the five existing annotation categories. Configuration version `1.0` contains independent text color, highlight color, bold, italic, underline, strikethrough, marker, font-size, line-spacing, and verse-spacing values. Presets are Classic Quiz, Soft Pastel, High Contrast, and Minimal. Configuration is separate from Scripture packs and analysis reports; exporting it does not change pack checksums or annotation offsets.

The renderer composes overlapping styles deterministically: frequency color takes priority for text color, compatible bold/italic/underline/strike properties are combined, and boundary markers are emitted only at exact annotation boundaries. Public configuration resolves as user override → administrator default → built-in fallback. The existing visibility preference key remains independent.

The tokenizer treats apostrophe- and hyphen-connected lexical units as one word. Therefore `us-ward` receives one frequency entry and does not create a standalone `ward` annotation. Existing analysis sidecars containing hyphen-split annotations must be regenerated before they can represent the corrected rule; this change does not regenerate or modify checked-in material.
