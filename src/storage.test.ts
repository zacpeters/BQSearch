import { describe, expect, it, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { getPacks, getSettings, savePack, saveSettings } from './storage';
import { demoPack } from './data/demoPack';
describe('offline persistence', () => { beforeEach(() => indexedDB.deleteDatabase('scripture-lookup')); it('stores packs and settings locally', async () => { await savePack(demoPack); await saveSettings({seasonId: demoPack.season.id, division:'Juniors', studyStart:2, studyEnd:4, installedPackId:demoPack.id}); expect((await getPacks())[0].id).toBe(demoPack.id); expect((await getSettings())?.division).toBe('Juniors'); }); });
