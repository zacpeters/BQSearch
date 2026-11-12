import { describe, expect, it, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { getPacks, getSettings, savePack, saveSettings } from './storage';
import bundledPack from '../public/packs/season-2027-v1-1.0.0.json';
import type { ScripturePack } from './types';
const fixturePack = bundledPack as ScripturePack;
describe('offline persistence', () => { beforeEach(() => indexedDB.deleteDatabase('scripture-lookup')); it('stores packs and settings locally', async () => { await savePack(fixturePack); await saveSettings({seasonId: fixturePack.season.id, division:'Juniors', studyStart:2, studyEnd:4, installedPackId:fixturePack.id}); expect((await getPacks())[0].id).toBe(fixturePack.id); expect((await getSettings())?.division).toBe('Juniors'); }); });
