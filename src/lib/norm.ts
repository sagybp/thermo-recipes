// Normalises Hebrew/English text so search ignores niqqud, quotes, punctuation and case.
export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[֑-ׇ]/g, '')
    .replace(/["'`׳״’‘“”\-–—_.,()/\\:;!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
