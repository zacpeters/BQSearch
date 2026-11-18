import catalogUrl from './bqquiz-2027.json?url&no-inline';
import { verifyCatalog } from './loader';

export const BUNDLED_CATALOG_DIGEST = 'ecd61f65af143dcfa64a0a26d2a82a633aa5fc99e0f25f8facdeb7006f3177d4';

export async function loadBundledCatalog() {
  const response = await fetch(catalogUrl);
  if (!response.ok) throw new Error(`Published quiz catalog request failed (${response.status}).`);
  const result = await verifyCatalog(await response.json(), BUNDLED_CATALOG_DIGEST);
  if (!result.catalog) throw new Error(result.errors.join(' '));
  return {
    ...result.catalog,
    catalogVersion: `${result.catalog.catalogVersion}+${BUNDLED_CATALOG_DIGEST.slice(0, 12)}`,
  };
}
