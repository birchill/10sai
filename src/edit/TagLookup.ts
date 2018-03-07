import DataStore from '../store/DataStore';
import { LRUMap } from '../utils/lru';

const MAX_SESSION_TAGS = 3;
const MAX_SUGGESTIONS = 6;

const LOOKUP_CACHE_SIZE = 15;

interface TagLookupOptions {
  maxSessionTags?: number;
  maxSuggestions?: number;
}
// Result of a call to SuggestionResult.
//
// At least one of |initialResult| or |asyncResult| must be set.
interface SuggestionResult {
  // If set, provides the result that could be determined synchronously.
  // If |asyncResult| is also set, the value of |asyncResult| is guaranteed to
  // be an extension of |initialResult|, i.e. elements are only appended to
  // |initialResult|.
  initialResult?: string[];

  // If set, indicates that an asynchronous lookup is being performed. Once
  // complete, the result of the asynchronous lookup is returned.
  // If a subsequent call to getSuggestions is made while the lookup is in
  // progress, the Promise will be rejected.
  asyncResult?: Promise<string[]>;
}

// Note to self: From a UI point of view what we're hoping for here is:
// -- If we have any kind of initialResult, show it
// -- If "asyncResult" is set, display a spinner
// -- If we have an undefined initialResult, make any current entries disabled
//    while we wait

export class TagLookup {
  store: DataStore;

  // Tags that have been *entered* (i.e. added to cards) this session.
  sessionTags: LRUMap<string, undefined>;

  // The current string we may be doing a lookup for.
  currentInput: string;

  // Cache of tags we have looked up.
  lookupCache: LRUMap<string, string[]>;

  // The maximum number of initial suggestions to display based on tags that
  // have already been added in this session.
  maxSessionTags: number;

  // The total maximum number of suggestions to return.
  maxSuggestions: number;

  constructor(store: DataStore, options?: TagLookupOptions) {
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
    this.currentInput = '';
    this.lookupCache = new LRUMap(LOOKUP_CACHE_SIZE);
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
      // Utility function to de-dupe session tags and tags we looked up in the
      // database whilst maintaining existing order of suggestions and trim
      // to the maximum number of suggestions.
      //
      // (ES6 Sets maintain insertion order including when dupes are added
      // which is very convenient for us.)
      const mergeLookupTagsWithSessionTags = (
        sessionTags: string[],
        lookupTags: string[]
      ): string[] =>
        [...new Set(sessionTags.concat(lookupTags))].slice(
          0,
          this.maxSuggestions
        );

      // Add as many session tags as we have
      const sessionTags: string[] = [...this.sessionTags.keys()].reverse();

      // If we have a cached result, return straight away
      if (this.lookupCache.has('')) {
        result.initialResult = mergeLookupTagsWithSessionTags(
          sessionTags,
          this.lookupCache.get('')!
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
            reject();
          }

          resolve(mergeLookupTagsWithSessionTags(sessionTags, tags));
        });
      });

      return result;
    }

    // XXX If we have a direct hit on the cache, return synchronously.
    // XXX If we have a substring hit on the cache and the number of results is
    //     less than the maximum, return synchronously.
    // XXX Debounce lookups?

    result.asyncResult = new Promise<string[]>((resolve, reject) => {
      this.store.getTags(input, this.maxSuggestions).then(tags => {
        this.lookupCache.set(input, tags);

        if (this.currentInput !== input) {
          reject();
        }

        resolve(tags);
      });
    });

    return result;
  }

  clearCache() {
    // XXX Clear current input here too
  }
}

export default TagLookup;
