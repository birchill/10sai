import DataStore from '../store/DataStore';
import { LRUMap } from '../utils/lru';
import { SuggestionResult } from './SuggestionResult';
import { findSubstringMatch, mergeAndTrimSuggestions } from './utils';

const MAX_SESSION_TAGS = 3;
const MAX_SUGGESTIONS = 6;
const LOOKUP_CACHE_SIZE = 15;

interface TagSuggesterOptions {
  maxSessionTags?: number;
  maxSuggestions?: number;
}

export class TagSuggester {
  store: DataStore;

  // Tags that have been *entered* (i.e. added to cards) this session.
  sessionTags: LRUMap<string, undefined>;

  // The current string we may be doing a lookup for.
  currentInput?: string;

  // Cache of tags we have looked up.
  lookupCache: LRUMap<string, string[]>;

  // The maximum number of initial suggestions to display based on tags that
  // have already been added in this session.
  maxSessionTags: number;

  // The total maximum number of suggestions to return.
  maxSuggestions: number;

  constructor(store: DataStore, options?: TagSuggesterOptions) {
    this.store = store;

    this.maxSessionTags =
      options && typeof options.maxSessionTags !== 'undefined'
        ? options.maxSessionTags
        : MAX_SESSION_TAGS;
    this.maxSuggestions = Math.max(
      options && typeof options.maxSuggestions !== 'undefined'
        ? options.maxSuggestions
        : MAX_SUGGESTIONS,
      this.maxSessionTags
    );

    this.sessionTags = new LRUMap(this.maxSessionTags);
    this.lookupCache = new LRUMap(LOOKUP_CACHE_SIZE);

    // Whenever there is change to the cards, our cached tag lookups might be
    // wrong so drop them.
    this.store.changes.on('card', () => {
      this.lookupCache.clear();
    });
  }

  recordAddedTag(tag: string) {
    this.sessionTags.set(tag, undefined);
  }

  getSuggestions(input: string): SuggestionResult {
    const result: SuggestionResult = {};

    this.currentInput = input;

    // Initial suggestions case:
    //
    // This is special because when there is no input we return not only
    // frequently used tags, but also tags that have been used recently in this
    // session (e.g. for when you're adding the same tag to a bunch of cards).
    if (input === '') {
      // Add as many session tags as we have
      const sessionTags: string[] = [...this.sessionTags.keys()].reverse();

      // If we have a cached result, return straight away
      if (this.lookupCache.has(input)) {
        result.initialResult = mergeAndTrimSuggestions(
          sessionTags,
          this.lookupCache.get(input)!,
          this.maxSuggestions
        );
        return result;
      }

      result.initialResult = sessionTags;
      result.asyncResult = new Promise<string[]>((resolve, reject) => {
        // Fetch up to the full number of suggestions in case all the session
        // tags we added are duped.
        this.store.getTags(input, this.maxSuggestions).then(tags => {
          this.lookupCache.set(input, tags);

          // If a subsequent lookup has been initiated, reject.
          //
          // (Strictly speaking we should reject even if these match if we have
          // done multiple subsequent lookups and ended up at the same string.)
          if (this.currentInput !== input) {
            reject(new Error('AbortError'));
          }

          resolve(
            mergeAndTrimSuggestions(sessionTags, tags, this.maxSuggestions)
          );
        });
      });

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
      this.store.getTags(input, this.maxSuggestions).then(tags => {
        this.lookupCache.set(input, tags);

        if (this.currentInput !== input) {
          reject(new Error('AbortError'));
        }

        resolve(tags);
      });
    });

    return result;
  }
}

export default TagSuggester;
