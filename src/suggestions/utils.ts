import { LRUMap } from '../utils/lru';

// KeywordSuggester and TagSuggester common functionality.

// Combine and de-dupe two arrays of suggestions preserving their order and
// trimming as necessary.
export function mergeAndTrimSuggestions(
  a: string[],
  b: string[],
  maxLength: number
): string[] {
  return [...new Set(a.concat(b))].slice(0, maxLength);
}

// Look in |cache| for records that match some part of |input|.
export function findSubstringMatch(
  input: string,
  cache: LRUMap<string, string[]>,
  maxSuggestions: number // <-- Used to determine if we need to fetch more
): string[] | null {
  let substringKey = input;
  while (substringKey.length) {
    if (cache.has(substringKey)) {
      const substringResult = cache.get(substringKey)!;

      // If we are looking up a substring and our cached result includes the
      // maximum possible number of results then it's possible there are more
      // matches in the database that we truncated when we fetched the
      // substring so we should do the async lookup.
      if (
        substringKey.length < input.length &&
        substringResult.length >= maxSuggestions
      ) {
        break;
      }

      // (We *could* store this result in our lookup cache but it's not
      // necessary since we can deduce it from our map.)
      return substringResult.filter(token =>
        token.toLowerCase().startsWith(input.toLowerCase())
      );
    }
    substringKey = substringKey.substr(0, substringKey.length - 1);
  }

  return null;
}
