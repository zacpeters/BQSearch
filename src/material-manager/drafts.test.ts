import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { discardMaterialDraft, getMaterialDraft, saveMaterialDraft } from './drafts';

describe('Material Manager draft persistence', () => {
  beforeEach(async () => {
    await discardMaterialDraft();
  });

  it('saves and restores source files and division assignments', async () => {
    const snapshot = {
      input: '', format: 'txt' as const, sourceFiles: [{ fileName: '2027-Junior.txt', division: 'Junior' as const, text: 'Psalms 3:1' }],
      corpusText: '', corrections: {}, retrieved: {}, pack: { id: 'season-2027-v1', title: '2027', version: '1.0.0', seasonId: 'season-2027', seasonName: '2027', year: 2027 }, importDivision: 'Junior' as const,
    };
    await saveMaterialDraft(snapshot);
    expect((await getMaterialDraft())?.sourceFiles[0].division).toBe('Junior');
    expect((await getMaterialDraft())?.sourceFiles[0].fileName).toBe('2027-Junior.txt');
  });

  it('discards a draft explicitly', async () => {
    await saveMaterialDraft({ input: 'Psalms 3:1', format: 'txt', sourceFiles: [], corpusText: '', corrections: {}, retrieved: {}, pack: { id: 'x', title: 'x', version: '1', seasonId: 'x', seasonName: 'x', year: 2027 }, importDivision: 'Beginner' });
    await discardMaterialDraft();
    expect(await getMaterialDraft()).toBeUndefined();
  });
});
