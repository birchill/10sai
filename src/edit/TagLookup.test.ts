import PouchDB from 'pouchdb';

import TagLookup from './TagLookup';
import DataStore from '../store/DataStore';
import { waitForEvents } from '../../test/testcommon';

PouchDB.plugin(require('pouchdb-adapter-memory'));

describe('TagLookup', () => {
  // XXX Should we just mock this and move the tests for looking up tags etc. to
  // the DataStore tests?
  let store: DataStore;
  let subject: TagLookup;

  beforeEach(() => {
    store = new DataStore({
      pouch: { adapter: 'memory' },
      prefetchViews: false,
    });
    subject = new TagLookup(store);
  });

  afterEach(() => {
    return store.destroy();
  });

  it('returns no tags initially', async () => {
    const callback = () => {
      // We should never be called
      expect(false).toBe(true);
    };

    const result = subject.getSuggestions('', callback);
    expect(result).toEqual([]);

    // Wait a while to make sure the callback is not called
    await waitForEvents(5);
  });

  it('returns recently added tags synchronously', () => {
    subject.recordAddedTag('A');
    subject.recordAddedTag('B');
    subject.recordAddedTag('C');
    subject.recordAddedTag('A'); // Bump A's access time
    subject.recordAddedTag('D'); // B should be dropped

    const result = subject.getSuggestions('', () => {});
    expect(result).toEqual(['D', 'A', 'C']);
  });

  it('returns frequently used tags asynchronously', () => {
    // XXX
  });

  it('returns less suggestions when there are more session tags', () => {
    // XXX
  });

  it('de-duplicates recent and frequent tags', () => {
    // XXX
  });
});
