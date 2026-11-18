// @vitest-environment node
import { expect, it } from 'vitest';
import approved from './bqquiz-2027.json';
import { BUNDLED_CATALOG_DIGEST } from './bundled';
import { combineCatalogs } from './combine';
import { validateCatalog, verifyCatalog } from './loader';

it('verifies the complete authorized catalog and rejects changes to its question content', async () => {
  const result = await verifyCatalog(approved, BUNDLED_CATALOG_DIGEST);
  expect(result).toMatchObject({ valid: true, errors: [], warnings: [] });
  const catalog = result.catalog!;
  expect(catalog.catalogDigest).toBe(BUNDLED_CATALOG_DIGEST);
  expect(catalog.collections.map(collection => [collection.id, collection.publisher, collection.quizIds.length])).toEqual([
    ['bq-powers', 'BQ Powers', 25],
    ['lift-up', 'Lift Up', 20],
  ]);
  expect(catalog.quizzes).toHaveLength(45);
  expect(catalog.questions).toHaveLength(900);
  expect(catalog.questions.filter(question => question.collectionId === 'bq-powers')).toHaveLength(500);
  expect(catalog.questions.filter(question => question.collectionId === 'lift-up')).toHaveLength(400);
  expect(catalog.sourceSet).toEqual(approved.sourceSet);
  expect(catalog.collections).toEqual(approved.collections);
  expect(catalog.quizzes).toEqual(approved.quizzes);
  expect(catalog.questions).toEqual(approved.questions);
  const changed = { ...approved, questions: [{ ...approved.questions[0], rawAnswer: 'Different answer' }, ...approved.questions.slice(1)] };
  await expect(verifyCatalog(changed, BUNDLED_CATALOG_DIGEST)).resolves.toMatchObject({ valid: false, errors: [expect.stringContaining('Catalog digest mismatch')] });
});

it('uses the current bundled version without changing a previously installed copy', () => {
  const bundled = validateCatalog(approved).catalog!;
  const localCopy = structuredClone(bundled);
  const upgraded = {
    ...bundled,
    catalogVersion: 'next-version',
    questions: [{ ...bundled.questions[0], textRevision: 'updated' }, ...bundled.questions.slice(1)],
  };
  const result = combineCatalogs(upgraded, [localCopy]);
  expect(result?.catalogVersion).toBe('next-version');
  expect(result?.collections).toEqual(bundled.collections);
  expect(result?.quizzes).toEqual(bundled.quizzes);
  expect(result?.questions).toEqual(upgraded.questions);
  expect(localCopy).toEqual(bundled);
});
