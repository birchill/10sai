import { notes as subject, NoteState, NoteEditState } from './reducer';
import * as actions from './actions';

describe('reducer:notes', () => {
  const context: actions.EditNoteContext = { screen: 'edit-card', formId: 7 };

  const newNoteState = (
    newId: number,
    initialKeywords?: string[]
  ): NoteState => {
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

    expect(updatedState).toEqual([newNoteState(1)]);
  });

  const typicalNoteState = (): NoteState => ({
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
    initialState.push(typicalNoteState());

    const updatedState = subject(
      initialState,
      actions.addNoteWithNewId(context, 2)
    );

    expect(updatedState).toEqual([...initialState, newNoteState(2)]);
  });

  it('should fill in initial keywords on ADD_NOTE', () => {
    const initialState: Array<NoteState> = [];

    const updatedState = subject(
      initialState,
      actions.addNoteWithNewId(context, 3, ['initial', 'keywords'])
    );

    expect(updatedState).toEqual([newNoteState(3, ['initial', 'keywords'])]);
  });

  it('should update an existing note on EDIT_NOTE (matching on newId)', () => {
    const initialNoteState = {
      ...newNoteState(1),
      content: 'Original content',
    };
    const initialState = [initialNoteState];

    const updatedState = subject(
      initialState,
      actions.editNote(context, { newId: 1 }, { content: 'Updated content' })
    );

    expect(updatedState).toEqual([
      {
        ...initialNoteState,
        note: {
          content: 'Updated content',
        },
        dirtyFields: new Set(['content']),
        editState: NoteEditState.Dirty,
      },
    ]);

    // Check that we have new object identity too.
    expect(updatedState).not.toBe(initialState);
    expect(updatedState[0]).not.toBe(initialState[0]);
    expect(updatedState[0].note).not.toBe(initialNoteState);
  });

  it('should update an existing note on EDIT_NOTE (matching on note ID)', () => {
    const initialNoteState = typicalNoteState();
    const initialState = [newNoteState(1), initialNoteState, newNoteState(2)];

    const updatedState = subject(
      initialState,
      actions.editNote(
        context,
        { noteId: initialNoteState.note.id },
        { keywords: ['New', 'keywords'] }
      )
    );

    expect(updatedState).toEqual([
      newNoteState(1),
      {
        ...initialNoteState,
        note: {
          ...initialNoteState.note,
          keywords: ['New', 'keywords'],
        },
        dirtyFields: new Set(['keywords']),
        editState: NoteEditState.Dirty,
      },
      newNoteState(2),
    ]);
  });

  it('should do nothing on EDIT_NOTE if a matching note is not found', () => {
    // XXX
  });

  it('should ignore identical fields on EDIT_NOTE', () => {
    // XXX
  });

  it('should extend the set of dirty fields on EDIT_NOTE', () => {
    // XXX Include a set of dirty fields that *partially* overlaps
    // XXX Check that the set identity changes
  });

  it('should not include the ID in the set of dirty fields on EDIT_NOTE', () => {
    // XXX The action should include an ID when the previous one didn't include
    // one
  });
});
