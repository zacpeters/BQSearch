import { describe, expect, it } from 'vitest';
import { tokenizeScripture } from './tokenize';

describe('Scripture tokenization', () => {
  it('matches whole words case-insensitively and preserves offsets', () => {
    const tokens = tokenizeScripture('God, god; lovely love. he — the');
    expect(tokens.map(token => token.normalized)).toEqual(['god', 'god', 'lovely', 'love', 'he', 'the']);
    expect(tokens[0]).toMatchObject({ text: 'God', normalized: 'god', start: 0, end: 3, index: 0 });
    expect(tokens[3]).toMatchObject({ text: 'love', normalized: 'love', start: 17, end: 21 });
  });

  it('keeps contractions and hyphenated lexical units together', () => {
    expect(tokenizeScripture("heaven's well-known us-ward faith—faith").map(token => token.normalized)).toEqual(["heaven's", 'well-known', 'us-ward', 'faith', 'faith']);
  });

  it('handles Unicode letters and punctuation', () => {
    expect(tokenizeScripture('“Café”—café!').map(token => token.normalized)).toEqual(['café', 'café']);
  });
});

