import DataStore from '../store/DataStore';
import { LRUMap } from '../utils/lru';

type asyncSuggestionsCallbacks = (suggestions: string[]) => void;

const NUM_SESSION_TAGS = 3;
const LOOKUP_CACHE_SIZE = 15;

export class TagLookup {
  store: DataStore;

  // Tags that have been *entered* (i.e. added to cards) this session.
  sessionTags: LRUMap<string, undefined>;

  // Tags that are frequently used.
  frequentTags: string[];

  // The current string we may be doing a lookup for.
  currentInput: string;

  // Callback to call once performing any async lookup.
  asyncCallback?: asyncSuggestionsCallbacks;

  // Cache of tags we have looked up.
  lookupCache: LRUMap<string, string[]>;

  constructor(store: DataStore) {
    this.store = store;
    this.sessionTags = new LRUMap(NUM_SESSION_TAGS);
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
  getSuggestions(input: string, callback: asyncSuggestionsCallback): string[] {
    const suggestions = [];
    if (input === '') {
      // Add as many session tags as we have
      suggestions.push(...[...this.sessionTags.keys()].reverse());

      // XXX Add this.frequentlyUsed tags up to our maximum number of tags.
      this.asyncCallback = callback;
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
    // XXX Clear async callback
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
