import { describe, expect, it, vi } from 'vitest';
import { batches, BibleApiKjvProvider, buildBibleApiUrl, RetrievalCache, retrieveKJVText } from './retrieval';

const verse = (reference: string, text = 'Verified KJV text') => { const match = reference.match(/^(.+) (\d+):(\d+)$/)!; return { reference, text, source: 'api' as const, translationId: 'kjv', translationName: 'King James Version' }; };
const storage = () => { const values = new Map<string, string>(); return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: () => {} } as unknown as Storage; };

describe('KJV API retrieval', () => {
  it('validates the KJV response and groups same-chapter references into one passage request', async () => {
    const calls: string[] = []; const fetcher = vi.fn(async (url: string) => { calls.push(url); return new Response(JSON.stringify({ translation_id: 'kjv', translation_name: 'King James Version', verses: [{ book_name: 'John', chapter: 3, verse: 16, text: 'Verified KJV text' }, { book_name: 'John', chapter: 3, verse: 17, text: 'Verified KJV text' }] }), { status: 200 }); });
    const provider = new BibleApiKjvProvider('https://example.test/', fetcher as unknown as typeof fetch); const result = await retrieveKJVText(['John 3:16', 'John 3:17'], provider, { minIntervalMs: 0, cache: new RetrievalCache(storage()) }); expect(result.failures).toHaveLength(0); expect(result.verses).toHaveLength(2); expect(calls).toHaveLength(1); expect(calls[0]).toBe('https://example.test/John+3:16-17?translation=kjv');
  });
  it('uses globalThis.fetch safely when no fetcher is injected', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ translation_id: 'kjv', translation_name: 'King James Version', verses: [{ book_name: 'Psalms', chapter: 3, verse: 1, text: 'Lord, how are they increased that trouble me!' }] }), { status: 200 })); vi.stubGlobal('fetch', fetcher); try { const result = await new BibleApiKjvProvider('https://example.test/').fetchPassage(['Psalms 3:1'], new AbortController().signal); expect(result[0].reference).toBe('Psalms 3:1'); expect(fetcher).toHaveBeenCalledOnce(); } finally { vi.unstubAllGlobals(); }
  });
  it('splits unordered noncontiguous references into safe contiguous batches', () => {
    expect(batches(['Psalms 3:4', 'Psalms 3:1', 'Psalms 3:2', 'Psalms 3:6'])).toEqual([['Psalms 3:1', 'Psalms 3:2'], ['Psalms 3:4'], ['Psalms 3:6']]); expect(buildBibleApiUrl('https://bible-api.com/', 'Psalms', 3, '1-4')).toBe('https://bible-api.com/Psalms+3:1-4?translation=kjv');
  });
  it('retries transient failures and reports partial failures', async () => {
    let attempts = 0; const provider = { fetchPassage: async (references: string[]) => { attempts++; if (references[0] === 'Romans 8:28') throw new Error('temporary'); return references.map(reference => verse(reference)); } }; const result = await retrieveKJVText(['John 3:16', 'Romans 8:28'], provider, { minIntervalMs: 0, maxRetries: 1, cache: new RetrievalCache(storage()) }); expect(attempts).toBeGreaterThan(1); expect(result.verses.some(item => item.reference === 'John 3:16')).toBe(true); expect(result.failures.some(item => item.reference === 'Romans 8:28')).toBe(true);
  });
  it('reuses cache entries without another network request', async () => {
    const cache = new RetrievalCache(storage()); let calls = 0; const provider = { fetchPassage: async (references: string[]) => { calls++; return references.map(reference => verse(reference)); } }; await retrieveKJVText(['John 3:16'], provider, { minIntervalMs: 0, cache }); const second = await retrieveKJVText(['John 3:16'], provider, { minIntervalMs: 0, cache }); expect(calls).toBe(1); expect(second.verses[0].source).toBe('cache');
  });
  it('supports cancellation and rejects invalid translation responses', async () => {
    const controller = new AbortController(); const slow = { fetchPassage: async () => { await new Promise(resolve => setTimeout(resolve, 30)); return [verse('John 3:16')]; } }; const pending = retrieveKJVText(['John 3:16'], slow, { minIntervalMs: 0, signal: controller.signal, cache: new RetrievalCache(storage()) }); controller.abort(); expect((await pending).cancelled).toBe(true); const badFetcher = vi.fn(async () => new Response(JSON.stringify({ translation_id: 'web', translation_name: 'World English Bible', verses: [] }), { status: 200 })); await expect(new BibleApiKjvProvider('https://example.test/', badFetcher as unknown as typeof fetch).fetchPassage(['John 3:16'], new AbortController().signal)).rejects.toThrow('Unexpected translation');
  });
  it('rejects unexpected and missing verses rather than importing extras', async () => {
    const extra = vi.fn(async () => new Response(JSON.stringify({ translation_id: 'kjv', translation_name: 'King James Version', verses: [{ book_name: 'Psalms', chapter: 3, verse: 1, text: 'one' }, { book_name: 'Psalms', chapter: 3, verse: 9, text: 'unexpected' }] }), { status: 200 })); await expect(new BibleApiKjvProvider('https://example.test/', extra as unknown as typeof fetch).fetchPassage(['Psalms 3:1'], new AbortController().signal)).rejects.toThrow('unexpected reference'); const missing = vi.fn(async () => new Response(JSON.stringify({ translation_id: 'kjv', translation_name: 'King James Version', verses: [{ book_name: 'Psalms', chapter: 3, verse: 1, text: 'one' }] }), { status: 200 })); await expect(new BibleApiKjvProvider('https://example.test/', missing as unknown as typeof fetch).fetchPassage(['Psalms 3:1', 'Psalms 3:2'], new AbortController().signal)).rejects.toThrow('missing one or more');
  });
});
