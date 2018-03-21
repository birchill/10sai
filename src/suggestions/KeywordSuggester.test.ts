import KeywordSuggester from './KeywordSuggester';
import DataStore from '../store/DataStore';
import EventEmitter from 'event-emitter';
import { waitForEvents } from '../../test/testcommon';

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
      maxSessionKeywords: 3,
      maxSuggestions: 6,
    });
  });

  it('returns guesses from cloze content', () => {
    // TODO: Once we hook up a dictionary we can put the な inside the cloze and
    // test that we drop it automatically
    const result = subject.getSuggestions({
      question: '[..superficial..]な関係',
      answer: '{生半可|なま|はん|か}な関係',
    });
    expect(result.initialResult).toEqual(['生半可']);
  });

  it('returns kanji guesses from cards that test readings', () => {
    const result = subject.getSuggestions({
      question: '眼差し',
      answer: 'まなざし\nLook',
    });
    expect(result.initialResult[0]).toEqual('眼差し');
  });

  it('returns guesses from cards that have simple answers', () => {
    const result = subject.getSuggestions({
      question: 'the former',
      answer: '{前者|ぜん|しゃ}',
    });
    expect(result.initialResult[0]).toEqual('前者');
  });
});
