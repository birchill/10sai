import { notes as subject, NoteState, NoteEditState } from './reducer';
import * as actions from './actions';

describe('reducer:notes', () => {
  const context: actions.EditNoteContext = { screen: 'edit-card', formId: 7 };

  const newNote = (newId: number, initialKeywords?: string[]): NoteState => {
    const result: NoteState = { newId, note: {}, editState: NoteEditState.Ok };
    if (initialKeywords) {
      result.note.keywords = initialKeywords;
    }
    return result;
  };

  it('should add an empty note on ADD_NOTE', () => {
    const initialState: Array<NoteState> = [];

    const updatedState = subject(
      initialState,
      actions.addNoteWithNewId(context, 1)
    );

    expect(updatedState).toEqual([newNote(1)]);
  });

  const typicalNote = (): NoteState => ({
    note: {
      id: 'abc',
      keywords: ['def', 'ghi'],
      content: 'Noterifictastical!',
      created: Date.now(),
      modified: Date.now(),
    },
    editState: NoteEditState.Ok,
  });

  it('should append new notes on ADD_NOTE', () => {
    const initialState = [];
    initialState.push(typicalNote());

    const updatedState = subject(
      initialState,
      actions.addNoteWithNewId(context, 2)
    );

    expect(updatedState).toEqual([...initialState, newNote(2)]);
  });

  it('should fill in initial keywords on ADD_NOTE', () => {
    const initialState: Array<NoteState> = [];

    const updatedState = subject(
      initialState,
      actions.addNoteWithNewId(context, 3, ['initial', 'keywords'])
    );

    expect(updatedState).toEqual([newNote(3, ['initial', 'keywords'])]);
  });
});
