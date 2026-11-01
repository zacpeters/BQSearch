# Phase 2 completion report

## Delivered

- Separate local-only Material Manager at `admin/`, with `npm run admin:dev` and `npm run admin:build`.
- TXT, CSV, JSON, pasted reference import, reference ranges, aliases, seasons, divisions, and explicit study numbers.
- Independent study sequence assignments per division through CSV/JSON inputs.
- Season/division import selectors with Beginner, Junior, Intermediate, and Experienced support; plain-text lists receive ordered study numbers automatically.
- Local KJV corpus loading from JSON, USFM, and pipe/tab-delimited text.
- Preparation-time HTTP corpus adapter with explicit errors; public search remains network-free.
- One-click bible-api.com KJV retrieval with same-chapter batching, 15/30-second throttling, timeout, retries, cancellation, cache reuse, response translation/reference validation, and retry of failed verses.
- Canonical reference normalization and 66-book chapter validation.
- Review table for invalid, duplicate, missing, and retrieval-error conditions.
- Manual correction entry with audit labeling.
- Versioned JSON pack export with source metadata and SHA-256 integrity checksum.
- Public app no longer exposes Material Manager or publishing controls.
- Documentation for source provenance, limitations, approval, rollback, and repository placement.

## Source decision

The verified API provider is bible-api.com: its documentation identifies the KJV translation, supports CORS and passage syntax, and states a 15-requests-per-30-seconds limit. Its terms prohibit downloading an entire Bible and do not independently specify a 1769 edition or provide a blanket redistribution grant. BQLookup fetches only requested passages and records this limitation in pack metadata. The local eBible/Crosswire KJV corpus workflow remains the fallback for maintainers who need a locally verified corpus.

## Verification

Run `npm test`, `npm run validate:packs`, `npm run build`, and `npm run admin:build`. No material was published and no deployment was performed.
