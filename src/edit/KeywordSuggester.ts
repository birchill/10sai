import DataStore from '../store/DataStore';
import { LRUMap } from '../utils/lru';
import { SuggestionResult } from './SuggestionResult';

// TODO: There is a lot of duplicated code between this and TagSuggester. Need
// to factor it out.

const MAX_SESSION_KEYWORDS = 3;
const MAX_SUGGESTIONS = 6;
const LOOKUP_CACHE_SIZE = 15;

interface KeywordSuggesterOptions {
  maxSessionKeywords?: number;
  maxSuggestions?: number;
}

export class KeywordSuggester {
  store: DataStore;

  // Keywords that have been *entered* (i.e. added to cards) this session.
  sessionKeywords: LRUMap<string, undefined>;

  // The current string we may be doing a lookup for.
  currentInput?: string;

  // Cache of keywords we have looked up.
  lookupCache: LRUMap<string, string[]>;

  // The maximum number of initial suggestions to display based on keywords that
  // have already been added in this session.
  maxSessionKeywords: number;

  // The total maximum number of suggestions to return.
  maxSuggestions: number;

  constructor(store: DataStore, options?: KeywordSuggesterOptions) {
    this.store = store;

    this.maxSessionKeywords =
      options && typeof options.maxSessionKeywords !== 'undefined'
        ? options.maxSessionKeywords
        : MAX_SESSION_KEYWORDS;
    this.maxSuggestions = Math.max(
      options && typeof options.maxSuggestions !== 'undefined'
        ? options.maxSuggestions
        : MAX_SUGGESTIONS,
      this.maxSessionKeywords
    );

    this.sessionKeywords = new LRUMap(this.maxSessionKeywords);
    this.lookupCache = new LRUMap(LOOKUP_CACHE_SIZE);

    // Whenever there is change to the cards or notes, our cached keyword
    // lookups might be wrong so drop them.
    this.store.changes.on('card', () => {
      this.lookupCache.clear();
    });
    // XXX Uncomment this once we implement notes!
    /*
    this.store.changes.on('note', () => {
      this.lookupCache.clear();
    });
     */
  }

  recordAddedKeyword(keyword: string) {
    this.sessionKeywords.set(keyword, undefined);
  }

  getSuggestions(input: string): SuggestionResult {
    const result: SuggestionResult = {};

    this.currentInput = input;

    // Initial suggestions case:
    //
    // When there is no input we return keywords based on the content and also
    // keywords that have been used recently in this session (e.g. for when
    // you're adding a number of cards around the same word).
    if (input === '') {
      const mergeGuessedAndSessionKeywords = (
        guessedKeywords: string[],
        sessionKeywords: string[]
      ): string[] =>
        [...new Set(guessedKeywords.concat(sessionKeywords))].slice(
          0,
          this.maxSuggestions
        );

      // TODO: Guess keywords here
      const guessedKeywords: string[] = [];

      // Add as many session keywords as we have
      const sessionKeywords: string[] = [
        ...this.sessionKeywords.keys(),
      ].reverse();

      result.initialResult = mergeGuessedAndSessionKeywords(
        sessionKeywords,
        this.lookupCache.get(input)!
      );
      return result;
    }

    // If we have a direct hit on the cache, return synchronously.
    let substringKey = input;
    while (substringKey.length) {
      if (this.lookupCache.has(substringKey)) {
        const substringResult = this.lookupCache.get(substringKey)!;

        // If we are looking up a substring and our cached result includes the
        // maximum possible number of results then it's possible there are more
        // matches in the database that we truncated when we fetched the
        // substring so we should do the async lookup.
        if (
          substringKey.length < input.length &&
          substringResult.length >= this.maxSuggestions
        ) {
          break;
        }

        result.initialResult = substringResult.filter(keyword =>
          keyword.toLowerCase().startsWith(input.toLowerCase())
        );
        // (We *could* store this result in our lookup cache but it's not
        // necessary since we can deduce it from our map.)
        return result;
      }
      substringKey = substringKey.substr(0, substringKey.length - 1);
    }

    result.asyncResult = new Promise<string[]>((resolve, reject) => {
      this.store.getKeywords(input, this.maxSuggestions).then(keywords => {
        this.lookupCache.set(input, keywords);

        if (this.currentInput !== input) {
          reject(new Error('AbortError'));
        }

        resolve(keywords);
      });
    });

    return result;
  }
}

export default KeywordSuggester;
