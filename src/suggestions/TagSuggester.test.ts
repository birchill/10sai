import TagSuggester from './TagSuggester';

type ChangeCallback = (change: any) => void;

class MockDataStore {
  _tags: string[] = [];
  _cbs: {
    [type: string]: ChangeCallback[];
  };
  changes: EventEmitter;

  constructor() {
    this._cbs = {};
    this.changes = {
      on: (type: string, cb: ChangeCallback) => {
        if (this._cbs[type]) {
          this._cbs[type].push(cb);
        } else {
          this._cbs[type] = [cb];
        }
      },
    } as EventEmitter;
  }

  __triggerChange(type, change) {
    if (!this._cbs[type]) {
      return;
    }

    for (const cb of this._cbs[type]) {
      cb(change);
    }
  }

  async getTags(prefix: string, limit: number): Promise<string[]> {
    const matchingTags = this._tags
      .filter(tag => tag.startsWith(prefix))
      .sort()
      .slice(0, limit);
    return Promise.resolve(matchingTags);
  }
}

describe('TagSuggester', () => {
  let store: MockDataStore;
  let subject: TagSuggester;

  beforeEach(() => {
    store = new MockDataStore();
    subject = new TagSuggester(store as any, {
      maxRecentTags: 3,
      maxSuggestions: 6,
    });
  });

  it('returns no tags initially', async () => {
    const result = subject.getSuggestions('');

    expect(result.initialResult).toEqual([]);
    expect(result.asyncResult).toBeTruthy();
    const asyncResult = await result.asyncResult;
    expect(asyncResult).toEqual([]);
  });

  it('returns recently added tags synchronously', () => {
    subject.recordRecentTag('A');
    subject.recordRecentTag('B');
    subject.recordRecentTag('C');
    subject.recordRecentTag('A'); // Bump A's access time
    subject.recordRecentTag('D'); // B should be dropped

    const result = subject.getSuggestions('');

    expect(result.initialResult).toEqual(['D', 'A', 'C']);
  });

  it('returns frequently used tags asynchronously', async () => {
    store._tags = ['F1', 'F2', 'F3'];
    subject.recordRecentTag('R1');
    subject.recordRecentTag('R2');
    subject.recordRecentTag('R3');

    const result = subject.getSuggestions('');

    expect(result.initialResult).toEqual(['R3', 'R2', 'R1']);
    const asyncResult = await result.asyncResult;
    expect(asyncResult).toEqual(['R3', 'R2', 'R1', 'F1', 'F2', 'F3']);
  });

  it('respects the maximum number of suggestions', async () => {
    store._tags = ['F1', 'F2', 'F3', 'F4', 'F5'];
    subject.recordRecentTag('R1');
    subject.recordRecentTag('R2');
    subject.recordRecentTag('R3');

    const result = subject.getSuggestions('');

    const asyncResult = await result.asyncResult;
    expect(asyncResult).toEqual(['R3', 'R2', 'R1', 'F1', 'F2', 'F3']);
  });

  it('de-duplicates recent and frequent tags', async () => {
    store._tags = ['A', 'C', 'E', 'G', 'I', 'K'];
    subject.recordRecentTag('A');
    subject.recordRecentTag('B');
    subject.recordRecentTag('C');

    const result = subject.getSuggestions('');

    const asyncResult = await result.asyncResult;
    expect(asyncResult).toEqual(['C', 'B', 'A', 'E', 'G', 'I']);
  });

  it('caches frequent tags', async () => {
    store._tags = ['D', 'E', 'F', 'G'];
    subject.recordRecentTag('A');
    subject.recordRecentTag('B');
    subject.recordRecentTag('C');

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
    subject.recordRecentTag('R1');
    subject.recordRecentTag('R2');
    subject.recordRecentTag('R3');

    const result = subject.getSuggestions('ABC');

    expect(result.initialResult).toBeUndefined();
    const asyncResult = await result.asyncResult;
    expect(asyncResult).toEqual(['ABC', 'ABCD']);
  });

  it('returns direct cache hits immediately', async () => {
    store._tags = ['ABC', 'ABCD', 'AB', 'DEF'];

    // Do initial fetch
    const initialFetch = subject.getSuggestions('AB');
    await initialFetch.asyncResult;

    // Do a subsequent fetch
    const secondFetch = subject.getSuggestions('AB');
    expect(secondFetch.initialResult).toEqual(['AB', 'ABC', 'ABCD']);
    expect(secondFetch.asyncResult).toBeUndefined();
  });

  it('returns substring cache hits immediately', async () => {
    store._tags = ['ABC', 'ABCD', 'AB', 'DEF'];

    // Do initial fetch
    const initialFetch = subject.getSuggestions('AB');
    await initialFetch.asyncResult;

    // Do a subsequent fetch
    const secondFetch = subject.getSuggestions('ABC');
    expect(secondFetch.initialResult).toEqual(['ABC', 'ABCD']);
    expect(secondFetch.asyncResult).toBeUndefined();
  });

  it('does an async lookup when a substring cache hit might represent an incomplete result', async () => {
    // We have a lot of tags such that when we search for 'AB' we'll reach the
    // limit before we get to 'AB7'.
    store._tags = [
      'AB0',
      'AB1',
      'AB2',
      'AB3',
      'AB4',
      'AB5',
      'AB6',
      'AB7',
      'AB8',
    ];

    // Do initial fetch
    const initialFetch = subject.getSuggestions('AB');
    const initialAsyncResult = await initialFetch.asyncResult;
    // Sanity check: We should only get the first six results
    expect(initialAsyncResult).toEqual([
      'AB0',
      'AB1',
      'AB2',
      'AB3',
      'AB4',
      'AB5',
    ]);

    // Do a subsequent fetch
    const secondFetch = subject.getSuggestions('AB7');
    expect(secondFetch.initialResult).toBeUndefined();
    const secondAsyncResult = await secondFetch.asyncResult;
    expect(secondAsyncResult).toEqual(['AB7']);
  });

  it('rejects the async lookup when an overlapping request is performed', async () => {
    // First request
    const initialPromise = subject.getSuggestions('AB').asyncResult;

    // Second request (different string)
    subject.getSuggestions('ABC');

    await expect(initialPromise).rejects.toThrow('AbortError');
  });

  it('rejects the async lookup when an overlapping request is performed (initial lookup)', async () => {
    // First request
    const initialPromise = subject.getSuggestions('').asyncResult;

    // Second request (different string)
    subject.getSuggestions('AB');

    await expect(initialPromise).rejects.toThrow('AbortError');
  });

  it('clears the cache when cards are changed', async () => {
    store._tags = ['F1', 'F2', 'F3'];
    subject.recordRecentTag('R1');
    subject.recordRecentTag('R2');
    subject.recordRecentTag('R3');

    // Get initial result.
    const initialResult = subject.getSuggestions('');
    await initialResult.asyncResult;
    // At this point we should have R3, R2, R1, F1, F2, F3 in the cache for ''
    // such that a subsequent request for '' would return them immediately.

    // Trigger change to the data store
    store.__triggerChange('card', {});

    // Try again
    const result = subject.getSuggestions('');
    expect(result.initialResult).toEqual(['R3', 'R2', 'R1']);
    const asyncResult = await result.asyncResult;
    expect(asyncResult).toEqual(['R3', 'R2', 'R1', 'F1', 'F2', 'F3']);
  });
});
