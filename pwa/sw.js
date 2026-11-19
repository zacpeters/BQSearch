import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';

self.skipWaiting();
clientsClaim();

// Register before the precache route so both the scope root and index.html
// revalidate online. Fall back to the installed build as a unit when offline.
registerRoute(
  ({ request, sameOrigin }) => sameOrigin && request.mode === 'navigate',
  async context => {
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 3000);
    try {
      const response = await fetch(context.request.url, { cache: 'no-cache', signal: abort.signal });
      if (response.ok) return response;
    } catch {
      // A failed connection or timeout uses the installed app shell.
    } finally {
      clearTimeout(timeout);
    }
    return offlineShell(context);
  },
);

precacheAndRoute(self.__WB_MANIFEST);
const offlineShell = createHandlerBoundToURL('index.html');
cleanupOutdatedCaches();
