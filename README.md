# Scripture Lookup

Standalone, offline-first Bible Quizzing Scripture Lookup. Phase 1 is a local React + TypeScript + Vite application with an installable PWA shell, IndexedDB persistence, and a pure local search engine.

## Development

```bash
npm install
npm run dev       # local development server
npm test          # automated tests
npm run build     # type-check and production build
```

The production GitHub Pages build uses `VITE_BASE_PATH=/BQLookup/`. Other static hosts can use the default `/` base or provide a different `VITE_BASE_PATH` at build time. Vite and the PWA plugin rewrite the generated manifest, service worker, and cached asset URLs for that base path.

The app does not call an API during Scripture searches. The included Demonstration Pack is clearly labeled development-only and is not official tournament material. It exists only to exercise the interface and tests.

## Phase 1 architecture

- `src/types.ts` contains versioned schemas for seasons, divisions, verses, study sequence numbers, packs, settings, and search results.
- `src/search.ts` is a pure, network-free search engine. It supports references, legacy book aliases, words, exact phrases, verse starts, and study-number/range searches. Study sequence numbers are separate from chapter and verse fields.
- `src/storage.ts` uses IndexedDB for installed packs and tournament settings.
- `public/packs/*.json` contains versioned static pack artifacts. `downloadPack()` fetches a base-aware pack URL, validates its top-level shape, and retains it in IndexedDB.
- `src/data/demoPack.ts` is the development fixture; importing/publishing official packs is intentionally outside this public app.
- `vite-plugin-pwa` creates the service worker and offline application shell.

## Phase 1 status

Implemented: responsive touch-first search, keyboard input, three views, local filtering by division and study range, IndexedDB persistence, PWA configuration, local search, and automated tests.

Placeholder: Material Manager UI, which only reports installed local packs and can reinstall the demonstration fixture.

Future development: separately hosted authorized administration, pack import validation and signing, official season content pipeline, richer reference ranges, and production accessibility/device QA. No authentication or publishing actions are faked in this phase.

## GitHub Pages preparation

The repository is prepared for a public repository named `BQLookup`. Enable GitHub Pages in repository Settings → Pages → Source: GitHub Actions. The workflow in `.github/workflows/deploy-pages.yml` runs only for `main`, installs dependencies, runs tests, builds with the project base path, uploads `dist`, and deploys it. Its permissions are limited to read-only repository access plus the Pages deployment token permissions required by GitHub.

Updates are made by merging to `main`; the workflow rebuilds and replaces the Pages artifact. To roll back, revert the offending commit and merge the revert to `main`, or rerun a prior known-good commit through a controlled branch update. Publishing official material remains a maintainer-only repository operation; public users only download static published artifacts and retain them locally.
