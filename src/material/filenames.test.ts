import { describe, expect, it } from 'vitest';
import { suggestedAnalysisFilename, suggestedMaterialFilename } from './filenames';

const pack = { title: '2027 Psalms Beginner', season: { year: 2027 } };

describe('material download filenames', () => {
  it('creates readable stable names from material metadata', () => {
    expect(suggestedMaterialFilename(pack)).toBe('Psalms-2027-Material.json');
    expect(suggestedAnalysisFilename(pack, 'Beginner')).toBe('Psalms-2027-Beginner-Analysis-1.1.json');
  });
});
