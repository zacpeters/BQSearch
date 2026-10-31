import type { ScripturePack } from '../types';

// Development-only content. This is not an official Scripture pack.
export const demoPack: ScripturePack = {
  id: 'demo-2026', schemaVersion: '1.0', title: 'Demonstration Pack', version: '0.1.0-demo', status: 'demo',
  season: { id: 'demo-season-2026', name: 'Demonstration Season', year: 2026, schemaVersion: '1.0' },
  verses: [
    { id: 'john-3-16', book: 'John', chapter: 3, verse: 16, studyNumber: 1, divisions: ['Juniors','Intermediate','Seniors'], text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.' },
    { id: 'psalm-23-1', book: 'Psalms', chapter: 23, verse: 1, studyNumber: 2, divisions: ['Juniors','Intermediate','Seniors'], text: 'The LORD is my shepherd; I shall not want.' },
    { id: 'romans-8-28', book: 'Romans', chapter: 8, verse: 28, studyNumber: 3, divisions: ['Intermediate','Seniors'], text: 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.' },
    { id: 'philippians-4-13', book: 'Philippians', chapter: 4, verse: 13, studyNumber: 4, divisions: ['Juniors','Intermediate','Seniors'], text: 'I can do all things through Christ which strengtheneth me.' },
    { id: 'hebrews-12-1', book: 'Hebrews', chapter: 12, verse: 1, studyNumber: 5, divisions: ['Intermediate','Seniors'], text: 'Wherefore seeing we also are compassed about with so great a cloud of witnesses, let us lay aside every weight, and the sin which doth so easily beset us, and let us run with patience the race that is set before us.' },
    { id: 'matthew-5-16', book: 'Matthew', chapter: 5, verse: 16, studyNumber: 6, divisions: ['Juniors','Intermediate','Seniors'], text: 'Let your light so shine before men, that they may see your good works, and glorify your Father which is in heaven.' }
  ]
};
