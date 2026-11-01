# Scripture Annotation Architecture

This document proposes a future, deterministic annotation layer. It does not change the current pack format or public application.

## Goals and constraints

Annotations must leave the original KJV verse text unchanged, work offline, be reproducible by the local Material Manager, support administrator review and correction, and remain compatible with pack checksums and public search. No runtime API, AI service, or account should be required.

## Recommended model

Keep `text` as the authoritative immutable verse string. Add an optional versioned annotation object keyed by canonical verse ID:

```ts
type AnnotationPack = {
  schemaVersion: number;
  analyzerVersion: string;
  corpusChecksum: string;
  analysisScope: { seasonId: string; division: string };
  tokens: Token[];
  annotations: Annotation[];
  dictionaries: DictionaryVersion[];
  review: ReviewMetadata;
};

type Token = {
  id: string;
  start: number;
  end: number;
  normalized: string;
  surface: string;
  ordinal: number;
};

type Annotation = {
  category: string;
  start: number;
  end: number;
  tokenIds: string[];
  source: 'analyzer' | 'dictionary' | 'manual';
  status: 'suggested' | 'reviewed' | 'rejected';
  confidence?: 'high' | 'medium' | 'low';
  note?: string;
};
```

The exact schema should be versioned independently from the base Scripture pack. The exported pack can reference an annotation-pack checksum or embed the reviewed annotations once the compatibility contract is approved.

## Deterministic tokenization

Use UTF-16 string offsets because JavaScript rendering APIs use them, while also storing the surface form for auditability. Tokenize case-insensitively for matching, preserve exact surface text, and discard punctuation only from the normalized comparison key. Apostrophes and hyphens need an explicit policy tested with fixtures. Never stem words.

Every annotation should point to token IDs and offsets. This avoids modifying KJV text and makes rendering robust when punctuation is adjacent to a token. Offsets must be validated against the exact text checksum.

## Frequency analysis

For each season/division analysis scope, count normalized tokens across the complete study material, not the currently visible range. Repeated tokens in one verse count separately. Store both:

- `totalOccurrences`: every token occurrence;
- `distinctVerseCount`: number of canonical verses containing the token.

Store occurrence references and abbreviated references for 2x/3x words. A visible range filters displayed verses only; it must not recompute or change the analysis scope. Division-specific analyses must be separate, even when verses overlap.

## Unique beginnings and endings

Compute these deterministically over the selected division’s complete ordered study material. A beginning candidate is the shortest prefix that distinguishes a verse from all other analyzed verses under the documented normalized comparison. An ending candidate uses the same rule on suffixes. Store token ranges rather than inserting `/` or `\\` into source text. If no unique prefix/suffix exists, emit no annotation and show that state in review.

The algorithm must define whether comparison is token-based or character-based. Token-based comparison is recommended for coaching usability; exact surface text remains available for display and audit. Tests must cover punctuation, one-token verses, duplicate text, chapter boundaries, and ties.

## Categories and ambiguity

Animals, body parts, geographic locations, and proper names should come from versioned dictionaries with canonical terms, aliases, exclusions, and notes. Dictionary matches are suggestions, not automatic approval. Ambiguous names and locations require review status and optional manual boundaries. A category should never be inferred from a generic substring without token boundaries.

Questions and exclamations can be detected from punctuation, but the review UI should show the matched punctuation and allow correction for unusual wording or source formatting.

## Overlap and rendering

Overlapping annotations are expected: a repeated word can also be a proper name, and a unique beginning can contain a frequency-highlighted token. Store all annotations independently. At render time, apply a deterministic precedence or nested-span renderer. Recommended precedence is to preserve semantic spans first, then apply frequency styles as token-level classes, with a conflict legend and user-toggle behavior. Never create invalid overlapping HTML ranges.

The public renderer should use text nodes plus validated spans, not HTML interpolation. Styles should be user preferences layered over administrator defaults. A reset operation should restore one category or all categories without changing pack data.

## Review and manual corrections

The local Material Manager should display source text, token boundaries, proposed annotations, dictionary source, and the exact analyzer version. Administrators can accept, reject, edit, or add annotations. Each correction records author label/local operator, timestamp, reason, previous value, and resulting value. This is an audit trail, not authentication.

Export should fail when required annotation review is incomplete if the selected annotation layer is declared official. Optional experimental annotations may remain outside an approved pack. Manual corrections must never be overwritten by cache refresh or re-analysis without explicit conflict resolution.

## Checksums and compatibility

Base verse text and metadata retain the existing pack checksum contract. Annotation checksums should cover canonicalized annotation JSON, base pack checksum, analyzer version, dictionary versions, and analysis scope. A public app must reject or ignore annotations whose base checksum does not match the installed pack. Older packs without annotations remain fully searchable.

## Performance and offline behavior

Analyze in the local Material Manager, preferably in a worker for large seasons. Cache analyzer results by base pack checksum, division, analyzer version, and dictionary versions. The public app only renders precomputed annotations and performs local filtering. Add a no-network test for lookup with annotations and a performance fixture representative of a full season.

## Decisions requiring approval

Before implementation, approve the token-based unique-prefix/suffix definition, annotation embedding versus a companion file, category dictionary ownership/versioning, overlap precedence, and whether official annotation review is required for every category or only for semantic categories.

