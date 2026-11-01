# BQ Search UI, UX, and deployment audit

## Findings and changes

- The public lookup already had the stronger utility-app language: compact toolbar, keyboard search, touch targets, Help, offline status, and restrained surfaces.
- The Material Manager had the same functional workflow but used a separate visual vocabulary and had no primary Help entry point. Shared design tokens now provide common typography, surfaces, borders, focus, spacing, and accent values; admin-specific styles consume those tokens without changing public search semantics.
- The Material Manager header now exposes Help on every workflow step. The Help Center covers getting started, multi-file import, validation, analysis, release downloads, Color Coding, drafts, troubleshooting, and offline limits. It distinguishes downloading from publishing.
- Both entry documents now have responsive metadata, titles, theme colors, and base-aware favicon references. The existing BQ Search SVG remains the brand identity; no unrelated logo was introduced.
- Focus-visible and reduced-motion defaults were added to the shared token layer. Existing responsive rules remain in place for dense review tables, formatting controls, and mobile workflow navigation.
- The Pages workflow now builds the Material Manager with `/BQSearch/admin/` and copies its entry and assets into `dist/admin/`. The public app remains at `/BQSearch/` and has no admin link.

## Confirmed limitations

- The repository currently has one SVG brand asset. It is used for the favicon, manifest icon, and Apple touch fallback; platform-specific PNG icon variants are not checked in.
- The Material Manager still uses a dense single-page DOM internally; CSS displays one workflow card at a time while Options and workflow controls remain shared. A future component split would improve maintainability but is not required for this audit.
- The PWA caches static packs and analysis files present at build time. Newly downloaded preparation files are browser downloads and must be copied into `public/` and rebuilt before public offline availability changes.
- A local rendered-browser smoke test was not possible in this restricted environment because binding a Vite server to `127.0.0.1:5173` returned `EPERM`. Production HTML, manifest, asset paths, and builds were inspected directly.

## Manual release checklist

Use `npm run admin:dev` for preparation, or build with `VITE_ADMIN_BASE_PATH=/BQSearch/admin/ npm run admin:build`. For Pages, enable **Settings → Pages → Source: GitHub Actions**, then merge reviewed changes to `main`. Verify `/BQSearch/`, `/BQSearch/admin/`, direct refresh of both routes, pack loading, Color Coding availability, and offline search after the service worker completes a load.
