import DataStore from '../store/DataStore';
import { LRUMap } from '../utils/lru';

type asyncSuggestionsCallback = (suggestions: string[]) => void;

const MAX_SESSION_TAGS = 3;
const MAX_SUGGESTIONS = 6;

const LOOKUP_CACHE_SIZE = 15;

interface TagLookupOptions {
  maxSessionTags?: number;
  maxSuggestions?: number;
}

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

  // This is a bit confusing but, for the same input we can end up returning
  // twice:
  //
  // - Once synchronously (e.g. filtering existing suggestions by the longer
  //   substring), and
  // - Once asynchronously after doing any DB lookup
  //
  // So the return type here is the initial synchronous result, while the second
  // argument to the function is the callback function to call if there are any
  // asynchronous results.
  //
  // NOTE: The set of suggestions returned by the async callback must NEVER
  // replace or re-order the synchronous results (since that would mean the user
  // might accidentally click the wrong thing).
  getSuggestions(input: string, callback: asyncSuggestionsCallback): string[] {
    // Initial suggestions case:
    if (input === '') {
      this.currentInput = input;

      const mergeFrequentTagsWithSessionTags = (
        sessionTags: string[],
        frequentTags: string[]
      ): string[] =>
        [...new Set(sessionTags.concat(frequentTags))].slice(
          0,
          this.maxSuggestions
        );

      // Add as many session tags as we have
      const sessionTags: string[] = [...this.sessionTags.keys()].reverse();

      // If we have a cached result, return straight away
      if (this.lookupCache.has('')) {
        return mergeFrequentTagsWithSessionTags(
          sessionTags,
          this.lookupCache.get('')!
        );
      }

      // Fetch up to the full number of suggestions in case all the session tags
      // we added are duped.
      this.store.getFrequentTags(this.maxSuggestions).then(frequentTags => {
        if (!frequentTags) {
          return;
        }

        this.lookupCache.set(input, frequentTags);

        if (this.currentInput !== input) {
          return;
        }

        // De-dupe (whilst maintaining existing order of suggestions) and trim
        // to the maximum number of suggestions.
        //
        // (ES6 Sets maintain insertion order including when dupes are added
        // which is very convenient for us.)
        callback(mergeFrequentTagsWithSessionTags(sessionTags, frequentTags));
      });

      // Return the session tags for now
      return sessionTags;
    }

    // XXX Progressively shorten the string (starting with the full string)
    // and check for matches in recent lookups.
    //
    // -- If there are any matches return them
    //
    // -- If we don't have an exact match, store the callback (after
    //    debouncing) and trigger an async lookup
    //    (Async lookup needs to check that currentInput matches input.
    //     It should store the result regardless, but only check the input
    //     string before calling the callback.)
    this.currentInput = input;

    return [];
  }

  reset() {
    // XXX Clear current input here
    // XXX Retrigger query for frequently used tags
  }
}

export default TagLookup;
