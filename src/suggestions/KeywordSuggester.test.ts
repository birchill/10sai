import { KeywordSuggester, RecentKeywordHandling } from './KeywordSuggester';

type ChangeCallback = (change: any) => void;

class MockDataStore {
  _tags: string[] = [];
  _cbs: {
    [type: string]: ChangeCallback[];
  };
  changes: EventEmitter;

  constructor() {
    this.changes = {
      on: (type: string, cb: ChangeCallback) => {},
    } as EventEmitter;
  }

  async getKeywords(prefix: string, limit: number): Promise<string[]> {
    return Promise.resolve([]);
  }
}

describe('KeywordSuggester', () => {
  let store: MockDataStore;
  let subject: KeywordSuggester;

  beforeEach(() => {
    store = new MockDataStore();
    subject = new KeywordSuggester(store as any, {
      maxRecentKeywords: 3,
      maxSuggestions: 6,
    });
  });

  it('returns guesses from cloze content', () => {
    // TODO: Once we hook up a dictionary we can put the な inside the cloze and
    // test that we drop it automatically
    const result = subject.getSuggestions(
      '',
      KeywordSuggester.getSuggestionsFromCard({
        front: '[..superficial..]な関係',
        back: '{生半可|なま|はん|か}な関係',
      }),
      RecentKeywordHandling.Omit
    );
    expect(result.initialResult).toEqual(['生半可']);
  });

  it('returns kanji guesses from cards that test readings', () => {
    const result = KeywordSuggester.getSuggestionsFromCard({
      front: '眼差し',
      back: 'まなざし\nLook',
    });
    expect(result[0]).toEqual('眼差し');
  });

  it('returns guesses from cards that have simple answers', () => {
    const result = KeywordSuggester.getSuggestionsFromCard({
      front: 'the former',
      back: '{前者|ぜん|しゃ}',
    });
    expect(result[0]).toEqual('前者');
  });

  it('returns the individual kanji characters as suggestions', () => {
    const result = KeywordSuggester.getSuggestionsFromCard({
      front: '眼差し',
      back: 'まなざし',
    });
    expect(result[1]).toEqual('眼');
    expect(result[2]).toEqual('差');
  });
});
