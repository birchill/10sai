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

  // Tags that are frequently used.
  frequentTags: string[];

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
    this.frequentTags = [];
    this.currentInput = '';
    this.lookupCache = new LRUMap(LOOKUP_CACHE_SIZE);

    // XXX Trigger query of frequently used tags
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
    const suggestions: string[] = [];
    if (input === '') {
      // Add as many session tags as we have
      suggestions.push(...[...this.sessionTags.keys()].reverse());

      // XXX Should we be storing the frequent tags here locally (or even as
      // part of our regular lookup cache.

      // Fetch up to the full number of suggestions in case all the session tags
      // we added are duped.
      this.store.getFrequentTags(this.maxSuggestions).then(frequentTags => {
        if (!frequentTags || this.currentInput !== input) {
          return;
        }

        // De-dupe (whilst maintaining existing order of suggestions) and trim
        // to the maximum number of suggestions.
        //
        // (ES6 Sets maintain insertion order including when dupes are added
        // which is very convenient for us.)
        callback(
          [...new Set(suggestions.concat(frequentTags))].slice(
            0,
            this.maxSuggestions
          )
        );
      });
    } else {
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
    }

    this.currentInput = input;

    return suggestions;
  }

  reset() {
    // XXX Clear current input here
    // XXX Retrigger query for frequently used tags
  }

  lookupFrequentlyUsedTags() {
    // Trigger query
    // Once it returns, store the result in this.frequentTags, and, if the
    // currentInput is '', call any stored async callback.
  }

  // XXX Add method here to querying frequently used tags
  // -- On done, if current input is empty, call async callback
}

export default TagLookup;
