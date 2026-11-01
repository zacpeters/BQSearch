/** A word token retains its original surface text and UTF-16 character offsets. */
export interface ScriptureToken {
  text: string;
  normalized: string;
  start: number;
  end: number;
  index: number;
}

// Internal apostrophes and hyphens stay with a lexical unit. Thus "well-known"
// and "us-ward" each produce one token, while surrounding punctuation remains
// outside the token and retains its original UTF-16 offsets.
const tokenPattern = /[\p{L}\p{N}]+(?:(?:['’]|-)[\p{L}\p{N}]+)*/gu;

export function normalizeWord(value: string): string {
  return value.toLocaleLowerCase();
}

export function tokenizeScripture(text: string): ScriptureToken[] {
  return [...text.matchAll(tokenPattern)].map((match, index) => ({
    text: match[0],
    normalized: normalizeWord(match[0]),
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
    index,
  }));
}

