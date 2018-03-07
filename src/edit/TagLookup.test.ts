import PouchDB from 'pouchdb';

import TagLookup from './TagLookup';
import DataStore from '../store/DataStore';
import { waitForEvents } from '../../test/testcommon';

class MockDataStore extends DataStore {
  _tags: string[] = [];

  async getTags(prefix: string, limit: number): Promise<string[]> {
    const matchingTags = this._tags
      .filter(tag => tag.startsWith(prefix))
      .sort()
      .slice(0, limit);
    return Promise.resolve(matchingTags);
  }
}

describe('TagLookup', () => {
  let store: MockDataStore;
  let subject: TagLookup;

  beforeEach(() => {
    store = new MockDataStore();
    subject = new TagLookup(store, { maxSessionTags: 3, maxSuggestions: 6 });
  });

  it('returns no tags initially', async () => {
    const result = subject.getSuggestions('');

    expect(result.initialResult).toEqual([]);
    expect(result.asyncResult).toBeTruthy();
    const asyncResult = await result.asyncResult;
    expect(asyncResult).toEqual([]);
  });

  it('returns recently added tags synchronously', () => {
    subject.recordAddedTag('A');
    subject.recordAddedTag('B');
    subject.recordAddedTag('C');
    subject.recordAddedTag('A'); // Bump A's access time
    subject.recordAddedTag('D'); // B should be dropped

    const result = subject.getSuggestions('');

    expect(result.initialResult).toEqual(['D', 'A', 'C']);
  });

  it('returns frequently used tags asynchronously', async () => {
    store._tags = ['F1', 'F2', 'F3'];
    subject.recordAddedTag('R1');
    subject.recordAddedTag('R2');
    subject.recordAddedTag('R3');

    const result = subject.getSuggestions('');

    expect(result.initialResult).toEqual(['R3', 'R2', 'R1']);
    const asyncResult = await result.asyncResult;
    expect(asyncResult).toEqual(['R3', 'R2', 'R1', 'F1', 'F2', 'F3']);
  });

  it('respects the maximum number of suggestions', async () => {
    store._tags = ['F1', 'F2', 'F3', 'F4', 'F5'];
    subject.recordAddedTag('R1');
    subject.recordAddedTag('R2');
    subject.recordAddedTag('R3');

    const result = subject.getSuggestions('');

    const asyncResult = await result.asyncResult;
    expect(asyncResult).toEqual(['R3', 'R2', 'R1', 'F1', 'F2', 'F3']);
  });

  it('de-duplicates recent and frequent tags', async () => {
    store._tags = ['A', 'C', 'E', 'G', 'I', 'K'];
    subject.recordAddedTag('A');
    subject.recordAddedTag('B');
    subject.recordAddedTag('C');

    const result = subject.getSuggestions('');

    const asyncResult = await result.asyncResult;
    expect(asyncResult).toEqual(['C', 'B', 'A', 'E', 'G', 'I']);
  });

  it('caches frequent tags', async () => {
    store._tags = ['D', 'E', 'F', 'G'];
    subject.recordAddedTag('A');
    subject.recordAddedTag('B');
    subject.recordAddedTag('C');

    // Do initial fetch
    const initialFetch = subject.getSuggestions('');
    await initialFetch.asyncResult;

    // Do a subsequent fetch
    const secondFetch = subject.getSuggestions('');
    expect(secondFetch.initialResult).toEqual(['C', 'B', 'A', 'D', 'E', 'F']);
    expect(secondFetch.asyncResult).toBeUndefined();
  });

  it('returns matching tags matching a prefix', async () => {
    store._tags = ['ABC', 'ABCD', 'AB', 'DEF'];
    subject.recordAddedTag('R1');
    subject.recordAddedTag('R2');
    subject.recordAddedTag('R3');

    const result = subject.getSuggestions('ABC');

    expect(result.initialResult).toBeUndefined();
    const asyncResult = await result.asyncResult;
    expect(asyncResult).toEqual(['ABC', 'ABCD']);
  });

  // XXX Test direct cache hit
  // XXX Test substring cache hit
  // XXX Test substring cache hit with possibly incomplete result
  // XXX Test Promise rejection
  // XXX Test cache clearing
});
