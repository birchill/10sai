import DataStore from '../store/DataStore';
import { LRUMap } from '../utils/lru';
import { SuggestionResult } from './SuggestionResult';
import { findSubstringMatch, mergeAndTrimSuggestions } from './utils';
import { Card } from '../model';
import { stripRuby } from '../text/ruby';
import { extractKeywordsFromCloze } from '../text/cloze';

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

  // The string we may be doing a lookup for or the Card we are guessing from.
  currentInput?: Partial<Card> | string;

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

  getSuggestions(input: Partial<Card> | string): SuggestionResult {
    const result: SuggestionResult = {};

    this.currentInput = input;

    // When there is no input we return keywords based on the content and also
    // keywords that have been used recently in this session (e.g. for when
    // you're adding a number of cards around the same word).
    if (typeof input === 'object') {
      const guessedKeywords: string[] = [];

      // Try looking for a cloze
      if (input.question && input.answer) {
        const prompt = stripRuby(input.question);
        const answer = stripRuby(input.answer);
        guessedKeywords.push(...extractKeywordsFromCloze(prompt, answer));
      }

      // Add as many session keywords as we have
      const sessionKeywords: string[] = [
        ...this.sessionKeywords.keys(),
      ].reverse();

      result.initialResult = mergeAndTrimSuggestions(
        guessedKeywords,
        sessionKeywords,
        this.maxSuggestions
      );
      return result;
    }

    // If we have a hit on the cache, return synchronously.
    const substringMatch = findSubstringMatch(
      input,
      this.lookupCache,
      this.maxSuggestions
    );
    if (substringMatch) {
      result.initialResult = substringMatch;
      return result;
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
