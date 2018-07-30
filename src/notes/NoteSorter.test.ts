import { NoteSorter } from './NoteSorter';
import { NoteState, SaveState } from './reducer';

describe('NoteSorter', () => {
  const getRandomString = (len: number): string =>
    (
      Array(len).join('0') +
      Math.floor(Math.random() * Math.pow(36, len)).toString(36)
    ).slice(-len);

  const noteState = (
    originalKeywords: Array<string>,
    formId: number
  ): NoteState => ({
    formId,
    note: {
      id: getRandomString(3),
      keywords: originalKeywords,
      content: getRandomString(10),
      created: Date.now(),
      modified: Date.now(),
    },
    saveState: SaveState.Ok,
    originalKeywords: new Set(
      originalKeywords.map(keyword => keyword.toLowerCase())
    ),
  });

  it('sorts based on the order of matches against the list of keywords', () => {
    const a = noteState(['ghi', 'def'], 1);
    const b = noteState(['def'], 2);
    const c = noteState(['abc', 'xyz'], 3);
    const notes = [a, b, c];
    const sorter = NoteSorter(['abc', 'def', 'ghi']);

    notes.sort(sorter);

    expect(notes).toEqual([c, a, b]);
  });

  it('sorts by formId secondly', () => {
    const a = noteState([], 1);
    const b = noteState(['def'], 2);
    const c = noteState(['def'], 3);
    const d = noteState([], 4);
    const notes = [a, b, c, d];
    const sorter = NoteSorter(['abc', 'def', 'ghi']);

    notes.sort(sorter);

    expect(notes).toEqual([b, c, a, d]);
  });

  it('does a case-insensitive comparison of keywords', () => {
    const a = noteState(['gHi', 'Def'], 1);
    const b = noteState(['def'], 2);
    const c = noteState(['Abc', 'xyz'], 3);
    const notes = [a, b, c];
    const sorter = NoteSorter(['AbC', 'dEf', 'GHI']);

    notes.sort(sorter);

    expect(notes).toEqual([c, a, b]);
  });
});
