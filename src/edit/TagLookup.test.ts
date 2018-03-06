import PouchDB from 'pouchdb';

import TagLookup from './TagLookup';
import DataStore from '../store/DataStore';
import { waitForEvents } from '../../test/testcommon';

class MockDataStore extends DataStore {
  _frequentTags: string[];

  async getFrequentTags(limit: number): Promise<string[]> {
    return Promise.resolve(this._frequentTags);
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

  it('returns frequently used tags asynchronously', done => {
    store._frequentTags = ['F1', 'F2', 'F3'];
    subject.recordAddedTag('R1');
    subject.recordAddedTag('R2');
    subject.recordAddedTag('R3');

    const result = subject.getSuggestions('', suggestions => {
      expect(suggestions).toEqual(['R3', 'R2', 'R1', 'F1', 'F2', 'F3']);
      done();
    });
    expect(result).toEqual(['R3', 'R2', 'R1']);
  });

  it('respects the maximum number of suggestions', done => {
    store._frequentTags = ['F1', 'F2', 'F3', 'F4', 'F5'];
    subject.recordAddedTag('R1');
    subject.recordAddedTag('R2');
    subject.recordAddedTag('R3');

    const result = subject.getSuggestions('', suggestions => {
      expect(suggestions).toEqual(['R3', 'R2', 'R1', 'F1', 'F2', 'F3']);
      done();
    });
  });

  it('de-duplicates recent and frequent tags', done => {
    store._frequentTags = ['A', 'C', 'E', 'G', 'I', 'K'];
    subject.recordAddedTag('A');
    subject.recordAddedTag('B');
    subject.recordAddedTag('C');

    const result = subject.getSuggestions('', suggestions => {
      expect(suggestions).toEqual(['C', 'B', 'A', 'E', 'G', 'I']);
      done();
    });
  });
});
