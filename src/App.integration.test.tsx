// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScripturePack } from './types';

const { fixturePack } = vi.hoisted(() => ({ fixturePack: {
  id: 'search-fixture', schemaVersion: '1.0', title: 'Search fixture', version: '1.0.0', status: 'approved',
  season: { id: 'fixture-season', name: 'Fixture', year: 2027, schemaVersion: '1.0' },
  verses: [
    { id: 'psalm-3-1', book: 'Psalms', chapter: 3, verse: 1, text: 'LORD, how are they increased that trouble me!', studyNumber: 10, studyNumbers: { Beginner: 10, Junior: 1 }, divisions: ['Beginner', 'Junior'] },
    { id: 'psalm-3-2', book: 'Psalms', chapter: 3, verse: 2, text: 'Many there be which say of my soul, There is no help for him in God.', studyNumber: 11, studyNumbers: { Beginner: 11, Junior: 5 }, divisions: ['Beginner', 'Junior'] },
    { id: 'psalm-3-3', book: 'Psalms', chapter: 3, verse: 3, text: 'But thou, O LORD, art a shield for me.', studyNumber: 12, studyNumbers: { Beginner: 12, Junior: 6 }, divisions: ['Beginner', 'Junior'] },
    { id: 'psalm-3-4', book: 'Psalms', chapter: 3, verse: 4, text: 'I cried unto the LORD with my voice.', studyNumber: 3, studyNumbers: { Beginner: 3, Junior: 2 }, divisions: ['Beginner', 'Junior'] },
    { id: 'john-3-2', book: 'John', chapter: 3, verse: 2, text: 'The same came to Jesus by night.', studyNumber: 20, studyNumbers: { Beginner: 20, Junior: 3 }, divisions: ['Beginner', 'Junior'] },
    { id: 'psalm-8-3', book: 'Psalms', chapter: 8, verse: 3, text: 'When I consider thy heavens.', studyNumber: 30, studyNumbers: { Beginner: 30, Junior: 4 }, divisions: ['Beginner', 'Junior'] },
  ],
} as ScripturePack }));

vi.mock('./storage', () => ({ getPacks: async () => [fixturePack], getSettings: async () => ({ seasonId: fixturePack.season.id, division: 'Beginner', studyStart: 1, studyEnd: 999, installedPackId: fixturePack.id }), savePack: async () => undefined, saveSettings: async () => undefined }));

import App from './App';
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('BQ Search live input integration', () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  beforeEach(async () => {
    localStorage.setItem('bq-search-walkthrough-v1', 'dismissed');
    window.matchMedia = (query: string) => ({ matches: query.includes('pointer: fine'), media: query, onchange: null, addListener: () => undefined, removeListener: () => undefined, addEventListener: () => undefined, removeEventListener: () => undefined, dispatchEvent: () => false });
    host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
    await act(async () => { root.render(<App />); await new Promise(resolve => setTimeout(resolve, 30)); });
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); });

  async function type(value: string) {
    const input = host.querySelector('input[aria-label="Search Scripture"]') as HTMLInputElement;
    await act(async () => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set; setter?.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); await flush(); });
  }

  it('updates results progressively for chapter and reference input', async () => {
    await type('3');
    expect(host.textContent).toContain('Psalms 3:1');
    expect(host.textContent).toContain('John 3:2');
    await type('Psa');
    expect(host.textContent).toContain('Continue typing a Scripture reference');
    await type('Psa ');
    expect(host.textContent).toContain('Continue typing a Scripture reference');
    await type('Psa 3');
    expect(host.textContent).toContain('Psalms 3:4');
    await type('Psa 3:');
    expect(host.textContent).toContain('Psalms 3:4');
    await type('Psa 3:4');
    expect(host.textContent).toContain('I cried unto the LORD');
  });

  it('keeps explicit study syntax separate from chapter searches', async () => {
    await type('#3');
    expect(host.textContent).toContain('Psalms 3:4');
    expect(host.textContent).not.toContain('John 3:2');
    await type('study:3');
    expect(host.textContent).toContain('Psalms 3:4');
    await type('ps8.3');
    expect(host.textContent).toContain('Psalms 8:3');
  });

  it('does not broaden invalid numeric input to the entire pack', async () => {
    await type('0');
    expect(host.textContent).toContain('Invalid reference');
    expect(host.textContent).not.toContain('Psalms 3:1');
    await type('00');
    expect(host.textContent).toContain('Invalid reference');
    await type('3:0');
    expect(host.textContent).toContain('Invalid reference');
    await type('3:5-2');
    expect(host.textContent).toContain('Invalid reference');
    await type('3');
    expect(host.textContent).toContain('Psalms 3:1');
  });

  it('uses the active division projection and selected range', async () => {
    const division = host.querySelector('select[aria-label="Division"]') as HTMLSelectElement;
    await act(async () => { division.value = 'Junior'; division.dispatchEvent(new Event('change', { bubbles: true })); await flush(); });
    await type('#3');
    expect(host.textContent).toContain('John 3:2');
    expect(host.textContent).not.toContain('Psalms 3:4');
  });

  it('keeps exact reference result counts separate from expanded context', async () => {
    await type('Psa 3:2');
    expect(host.textContent).toContain('1 result');
    expect(host.textContent).toContain('Psalms 3:2');
    expect(host.textContent).not.toContain('Psalms 3:3');
    const result = host.querySelector('#result-psalm-3-2') as HTMLElement;
    await act(async () => { result.click(); await flush(); });
    expect(host.textContent).toContain('Psalms 3:1');
    expect(host.textContent).toContain('Psalms 3:3');
    expect(host.textContent).toContain('1 result');
    expect(result.querySelector('button[aria-expanded="true"]')).not.toBeNull();
    await act(async () => { result.click(); await flush(); });
    expect(host.textContent).not.toContain('Psalms 3:1');
    const expand = result.querySelector('button[aria-label="Expand Psalms 3:2"]') as HTMLButtonElement;
    await act(async () => { expand.click(); await flush(); });
    expect(result.querySelector('button[aria-label="Collapse Psalms 3:2"]')).not.toBeNull();
    expect(Array.from(host.querySelectorAll('.quick-context button')).some(button => button.textContent === 'Copy reference')).toBe(true);
    expect(host.querySelector('.quick-context')?.textContent).not.toContain('Compare');
    await type('3.2');
    expect(host.textContent).toContain('Psalms 3:2');
    expect(host.textContent).not.toContain('Psalms 3:3');
  });

  it('supports ordered multi-reference search and per-result Quick Context', async () => {
    await type('Psa 3:2, Psa 8:3');
    expect(host.textContent).toContain('2 results');
    expect(host.textContent?.indexOf('Psalms 3:2')).toBeLessThan(host.textContent?.indexOf('Psalms 8:3') ?? 0);
    expect(host.querySelector('select[aria-label="Quick Context"]')).toBeNull();
    const context = host.querySelector('button[aria-label="Expand Psalms 3:2"]') as HTMLButtonElement;
    await act(async () => { context.click(); await flush(); });
    expect(host.textContent).toContain('Psalms 3:1');
    expect(host.textContent).toContain('2 results');
    expect(host.querySelector('button[aria-label="Collapse Psalms 3:2"]')).not.toBeNull();
    expect(host.querySelector('button[aria-label="Open Psalms 3:2"]')).toBeNull();
    expect(host.querySelector('.quick-context')?.textContent).not.toContain('Compare');
    expect(host.textContent).toContain('Selected verse · Psalms 3:2');
    expect(host.textContent).not.toContain('context unavailable');
  });

  it('supports simple exact-word operators without falling back', async () => {
    await type('LORD AND voice');
    expect(host.textContent).toContain('I cried unto the LORD with my voice.');
    await type('LORD OR Jesus');
    expect(host.textContent).toContain('The same came to Jesus by night.');
    await type('LORD AND');
    expect(host.textContent).toContain('Complete the AND/OR expression');
  });

  it('supports keyboard expansion and keeps Compare from collapsing a result', async () => {
    await type('Psa 3:2');
    const result = host.querySelector('#result-psalm-3-2') as HTMLElement;
    result.focus();
    await act(async () => { result.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await flush(); });
    expect(result.querySelector('button[aria-expanded="true"]')).not.toBeNull();
    const contextReference = host.querySelector('.quick-context .context-reference') as HTMLButtonElement;
    await act(async () => { contextReference?.click(); await flush(); });
    expect(result.querySelector('button[aria-expanded="true"]')).not.toBeNull();
    await act(async () => { result.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })); await flush(); });
    expect(result.querySelector('button[aria-expanded="false"]')).not.toBeNull();
  });

  it('invokes the native install prompt only after the install action is clicked', async () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    const installEvent = new Event('beforeinstallprompt', { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
    Object.defineProperties(installEvent, { prompt: { value: prompt }, userChoice: { value: Promise.resolve({ outcome: 'dismissed' as const }) } });
    await act(async () => { window.dispatchEvent(installEvent); await flush(); });
    expect(prompt).not.toHaveBeenCalled();
    const install = host.querySelector('button[aria-label="Install BQ Search"]') as HTMLButtonElement;
    await act(async () => { install.click(); await flush(); });
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('Installation was dismissed');
  });
});

