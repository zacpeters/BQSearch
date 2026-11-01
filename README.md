# BQ Search

Standalone, offline-first Bible Quizzing Scripture search. The working product name is **BQ Search** and the GitHub Pages project path is `/BQSearch/`; historical schema, database, and audit identifiers remain unchanged for compatibility. Phase 1 is a local React + TypeScript + Vite application with an installable PWA shell, IndexedDB persistence, and a pure local search engine.

## Development

```bash
npm install
npm run dev       # local development server
npm test          # automated tests
npm run build     # type-check and production build
```

The production GitHub Pages build uses `VITE_BASE_PATH=/BQSearch/` and is hosted at `https://zacpeters.github.io/BQSearch/`. Other static hosts can use the default `/` base or provide a different `VITE_BASE_PATH` at build time. Vite and the PWA plugin rewrite the generated manifest, service worker, and cached asset URLs for that base path.

The app does not call an API during Scripture searches. The included Demonstration Pack is clearly labeled development-only and is not official tournament material. It exists only to exercise the interface and tests. Open **Help** in BQ Search for the supported search syntax and offline workflow.

Use the install icon in the header when the browser offers installation. On iPhone and iPad, use Share → Add to Home Screen. Installation is optional: after the app shell, Scripture pack, and compatible analysis sidecar have loaded, the locally stored material remains available without a connection.

## Phase 1 architecture

- `src/types.ts` contains versioned schemas for seasons, divisions, verses, study sequence numbers, packs, settings, and search results.
- `src/search.ts` is a pure, network-free search engine. It supports references, legacy book aliases, words, exact phrases, verse starts, and study-number/range searches. Study sequence numbers are separate from chapter and verse fields.
- `src/storage.ts` uses IndexedDB for installed packs and tournament settings.
- `public/packs/*.json` contains versioned static pack artifacts. `downloadPack()` fetches a base-aware pack URL, validates its top-level shape, and retains it in IndexedDB.
- `src/data/demoPack.ts` is the development fixture; importing/publishing official packs is intentionally outside this public app.
- `vite-plugin-pwa` creates the service worker and offline application shell.

## Phase 1 status

Implemented: responsive touch-first search, keyboard input, three views, local filtering by division and study range, IndexedDB persistence, PWA configuration, local search, and automated tests.

Placeholder: Public lookup has no administrative controls. Local administration is a separate tool under `admin/`.

Future development: official season content pipeline, richer reference ranges, and production accessibility/device QA. Public lookup has no authentication or publishing actions.

## GitHub Pages preparation

The repository is prepared for the public repository `zacpeters/BQSearch`. Enable GitHub Pages in repository Settings → Pages → Source: GitHub Actions. The workflow in `.github/workflows/deploy-pages.yml` runs only for `main`, installs dependencies, runs tests, builds with `/BQSearch/` as the project base path, uploads `dist`, and deploys it. Its permissions are limited to read-only repository access plus the Pages deployment token permissions required by GitHub.

Updates are made by merging to `main`; the workflow rebuilds and replaces the Pages artifact. To roll back, revert the offending commit and merge the revert to `main`, or rerun a prior known-good commit through a controlled branch update. Publishing official material remains a maintainer-only repository operation; public users only download static published artifacts and retain them locally.

## Phase 2 local Material Manager

Run `npm run admin:dev` to open the separate local-only Material Manager. It is not linked from the public app and is not included in the GitHub Pages build. Load a TXT, CSV, or JSON reference list, then load a local KJV corpus and review the expanded references before export. `npm run admin:build` creates a separate `admin-dist/` artifact for local review only.

The one-click provider is [bible-api.com](https://bible-api.com/), using its documented `translation=kjv` endpoint. The provider documents KJV availability, browser CORS, passage requests, and a limit of 15 requests per 30 seconds; it also says not to download an entire Bible. BQLookup therefore fetches only imported passages, with one request per same-book/chapter batch, a 2.1-second minimum interval, bounded concurrency, timeout, retry/backoff, cancellation, and visible failures. The provider identifies the translation as “King James Version” but does not independently specify a 1769 edition, so packs record that limitation in source metadata and still require human approval. The provider does not supply a blanket redistribution license for this workflow; the KJV source is treated as public domain only where applicable, and maintainers remain responsible for legal review before publication. See the [provider documentation](https://bible-api.com/) and [KJV source repository](https://github.com/bible-api/kjv).

The local corpus option remains the authoritative fallback for offline preparation. It accepts local JSON, USFM, and pipe/tab-delimited text corpora; unsupported ZIP or malformed sources fail visibly and must be converted or loaded locally first. The importer does not silently fall back to another translation: missing corpus entries block export, and manual corrections are labeled and retained in the review audit trail.

Approved packs are exported to JSON with source metadata and a SHA-256 integrity checksum. Put reviewed packs under `public/packs/` through a maintainer-only repository change, preserve older versions, and update the public app only after review. The Pages workflow never generates or approves packs.

The development server opens the admin tool at `http://localhost:5173/admin/` automatically with `npm run admin:dev`; `admin-dist/` is ignored and is never part of the public build.

Plain-text imports use the selected Season and Division controls. The canonical current divisions are Beginner, Junior, Intermediate, and Experienced; legacy `Juniors` maps to `Junior` and legacy `Seniors` maps to `Experienced` during import. When a reference list omits study numbers, the importer assigns them in original input order starting at 1, independently for each division/import season. Explicit CSV/JSON study numbers are preserved, and range rows expand into consecutive study numbers.

For local lookup testing, use the Material Manager's **Install exported pack locally** action. It verifies the exported checksum, stores the approved pack in the shared browser IndexedDB, selects its season/division, and makes it available to the public lookup in the same browser origin. Reload the lookup tab afterward. This is a local preview path only; it does not publish or deploy the pack.
