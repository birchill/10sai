import { extractKanji } from './japanese';

// Possibly language-specific substrings and so forth that we want to match when
// looking up notes.
export function getKeywordVariants(
  keywords: string | Array<string>
): Array<string> {
  const result: Array<string> = [];
  const keywordsArray = Array.isArray(keywords) ? keywords : [keywords];

  // If the keyword contains kanji, extract each kanji as a keyword so we can
  // look up notes for the individual kanji.
  for (const keyword of keywordsArray) {
    result.push(...extractKanji(keyword));
  }

  // Drop any duplicates or any candidates that are already part of the
  // passed-in keywords.
  return [
    ...new Set(result.filter(variant => !keywordsArray.includes(variant))),
  ];
}
