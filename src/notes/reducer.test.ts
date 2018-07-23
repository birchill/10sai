import { notes as subject, NoteState, SaveState } from './reducer';
import * as actions from './actions';
import { Note } from '../model';
import { Omit } from '../utils/type-helpers';
import { EditNoteContext } from './actions';
import { StoreError } from '../store/DataStore';

describe('reducer:notes', () => {
  const baseContext: Omit<EditNoteContext, 'noteFormId'> = {
    screen: 'edit-card',
    cardFormId: 7,
  };
  const context = (formId: number): EditNoteContext => ({
    ...baseContext,
    noteFormId: formId,
  });

  const newNoteState = (
    formId: number,
    initialKeywords?: string[]
  ): NoteState => {
    const result: NoteState = { formId, note: {}, saveState: SaveState.New };
    if (initialKeywords) {
      result.note.keywords = initialKeywords;
    }
    return result;
  };

  it('should add an empty note on ADD_NOTE', () => {
    const initialState: Array<NoteState> = [];

    const updatedState = subject(
      initialState,
      actions.addNoteWithNewFormId(baseContext, 1)
    );

    expect(updatedState).toEqual([newNoteState(1)]);
  });

  const typicalNoteState = (formId: number): NoteState => ({
    formId,
    note: typicalNote(),
    saveState: SaveState.Ok,
  });

  const typicalNote = (): Note => ({
    id: 'abc',
    keywords: ['def', 'ghi'],
    content: 'Noterifictastical!',
    created: Date.now(),
    modified: Date.now(),
  });

  it('should append new notes on ADD_NOTE', () => {
    const initialState = [];
    initialState.push(typicalNoteState(5));

    const updatedState = subject(
      initialState,
      actions.addNoteWithNewFormId(baseContext, 6)
    );

    expect(updatedState).toEqual([...initialState, newNoteState(6)]);
  });

  it('should fill in initial keywords on ADD_NOTE', () => {
    const initialState: Array<NoteState> = [];

    const updatedState = subject(
      initialState,
      actions.addNoteWithNewFormId(baseContext, 3, ['initial', 'keywords'])
    );

    expect(updatedState).toEqual([newNoteState(3, ['initial', 'keywords'])]);
  });

  it('should update an existing note on EDIT_NOTE (matching on newId)', () => {
    const initialNoteState = newNoteState(1);
    initialNoteState.note.content = 'Original content';
    const initialState = [initialNoteState];

    const updatedState = subject(
      initialState,
      actions.editNote(context(1), { content: 'Updated content' })
    );

    expect(updatedState).toEqual([
      {
        ...initialNoteState,
        note: {
          ...initialNoteState.note,
          content: 'Updated content',
        },
        dirtyFields: new Set(['content']),
      },
    ]);

    // Check that we have new object identity too.
    expect(updatedState).not.toBe(initialState);
    expect(updatedState[0]).not.toBe(initialState[0]);
    expect(updatedState[0].note).not.toBe(initialNoteState);
  });

  it('should update an existing note on EDIT_NOTE (matching on note ID)', () => {
    const initialNoteState = typicalNoteState(2);
    const initialState = [newNoteState(1), initialNoteState, newNoteState(3)];

    const updatedState = subject(
      initialState,
      actions.editNote(context(2), { keywords: ['New', 'keywords'] })
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
      },
      newNoteState(3),
    ]);
  });

  it('should do nothing on EDIT_NOTE if a matching note is not found', () => {
    const initialNoteState = newNoteState(1);
    const initialState = [initialNoteState];

    const updatedState = subject(
      initialState,
      actions.editNote(context(2), { content: 'Updated content' })
    );

    expect(updatedState).toBe(initialState);
    expect(updatedState[0]).toBe(initialNoteState);
  });

  it('should ignore identical fields on EDIT_NOTE', () => {
    const initialNoteState = newNoteState(1);
    initialNoteState.note.content = 'Original content';
    initialNoteState.note.keywords = ['Original', 'keywords'];
    const initialState = [initialNoteState];

    const updatedState = subject(
      initialState,
      actions.editNote(context(1), {
        content: 'Updated content',
        keywords: ['Original', 'keywords'],
      })
    );

    expect(updatedState).toEqual([
      {
        ...initialNoteState,
        note: {
          ...initialNoteState.note,
          content: 'Updated content',
        },
        dirtyFields: new Set(['content']),
      },
    ]);
  });

  it('should extend the set of dirty fields on EDIT_NOTE', () => {
    const initialNoteState = typicalNoteState(1);
    initialNoteState.dirtyFields = new Set(['content']) as Set<keyof Note>;
    const initialState = [initialNoteState];

    const updatedState = subject(
      initialState,
      actions.editNote(context(1), {
        content: 'Updated content',
        keywords: ['Updated', 'keywords'],
      })
    );

    expect(updatedState).toEqual([
      {
        ...initialNoteState,
        note: {
          ...initialNoteState.note,
          content: 'Updated content',
          keywords: ['Updated', 'keywords'],
        },
        dirtyFields: new Set(['content', 'keywords']),
      },
    ]);
    // Check the set identity has also been updated
    expect(updatedState[0].dirtyFields).not.toBe(initialNoteState.dirtyFields);
  });

  it('should not include the ID in the set of dirty fields on EDIT_NOTE', () => {
    const initialNoteState = newNoteState(1);
    const initialState = [initialNoteState];

    const updatedState = subject(
      initialState,
      actions.editNote(context(1), { id: 'abc', content: 'Updated content' })
    );

    expect(updatedState).toEqual([
      {
        ...initialNoteState,
        note: {
          ...initialNoteState.note,
          id: 'abc',
          content: 'Updated content',
        },
        dirtyFields: new Set(['content']),
      },
    ]);
  });

  it('should update the save state on SAVE_NOTE', () => {
    const initialNoteState = newNoteState(1);
    // Set a save error just so we can check it is cleared
    initialNoteState.saveError = new StoreError(500, 'error', 'error');

    const initialState = [initialNoteState];
    const updatedState = subject(initialState, actions.saveNote(context(1)));

    expect(updatedState).toEqual([
      {
        ...initialNoteState,
        saveState: SaveState.InProgress,
        saveError: undefined,
      },
    ]);
  });

  it('should update state on FINISH_SAVE_NOTE', () => {
    // Setup a note with a dirty content field
    const initialNoteState = newNoteState(1);
    const initialState = [initialNoteState];
    const change = { content: 'Updated content' };
    let updatedState = subject(
      initialState,
      actions.editNote(context(1), change)
    );

    // Save it
    const savedNote = { ...initialNoteState.note, ...change, id: 'abc' };
    updatedState = subject(
      updatedState,
      actions.finishSaveNote(context(1), savedNote)
    );

    expect(updatedState).toEqual([
      {
        ...initialNoteState,
        note: savedNote,
        saveState: SaveState.Ok,
      },
    ]);
  });

  it(
    'should only update dirty-ness for fields that have not since changed' +
      ' on FINISH_SAVE_NOTE',
    () => {
      // Setup a note with a dirty content field
      const initialNoteState = newNoteState(1);
      const initialState = [initialNoteState];
      const change = { content: 'Updated content' };
      let updatedState = subject(
        initialState,
        actions.editNote(context(1), change)
      );

      // Prepare the saved version
      const savedNote = { ...initialNoteState.note, ...change, id: 'abc' };

      // Now do a subsequent change
      updatedState = subject(
        updatedState,
        actions.editNote(context(1), { content: 'Updated again' })
      );

      // And finish the save with the previous values
      updatedState = subject(
        updatedState,
        actions.finishSaveNote(context(1), savedNote)
      );

      expect(updatedState).toEqual([
        {
          ...initialNoteState,
          note: { ...savedNote, content: 'Updated again' },
          dirtyFields: new Set<keyof Note>(['content']),
          saveState: SaveState.Ok,
        },
      ]);
    }
  );

  it('should update the state on FAIL_SAVE_NOTE', () => {
    const initialNoteState = newNoteState(1);
    const initialState = [initialNoteState];

    // Make a change and try to save
    const change = { content: 'Updated content' };
    let updatedState = subject(
      initialState,
      actions.editNote(context(1), change)
    );
    updatedState = subject(updatedState, actions.saveNote(context(1)));
    const stateWhenBeginningToSave = updatedState[0];

    // Fail to save it
    const error = new StoreError(500, 'error', 'error');
    updatedState = subject(
      updatedState,
      actions.failSaveNote(context(1), error)
    );

    expect(updatedState).toEqual([
      {
        ...stateWhenBeginningToSave,
        saveState: SaveState.Error,
        saveError: error,
      },
    ]);
  });

  it('should update the note list on UPDATE_NOTE_LIST', () => {
    const noteState1 = typicalNoteState(1);
    const noteState2 = typicalNoteState(2);
    noteState2.note = { ...noteState2.note, id: 'def', content: 'Note 2' };
    const initialState = [noteState1, noteState2];

    const note3 = { ...typicalNote(), id: 'ghi', content: 'Note 3' };
    const updatedState = subject(
      initialState,
      // Use a different object identity for note1 to make sure we do a
      // comparison before updating anything.
      actions.updateNoteListWithNewFormIds(
        context(1),
        [{ ...(noteState1.note as Note) }, note3],
        [3, 4, 5]
      )
    );

    expect(updatedState).toEqual([
      noteState1,
      {
        formId: 3,
        note: note3,
        saveState: SaveState.Ok,
      },
    ]);
    // Furthermore, the object identity of the first note should be the same.
    expect(updatedState[0]).toBe(noteState1);
  });

  it('should update individual note fields on UPDATE_NOTE_LIST', () => {
    const noteState = typicalNoteState(1);
    const initialState = [noteState];

    const updatedNote = {
      ...(noteState.note as Note),
      content: 'Updated content',
    };
    const updatedState = subject(
      initialState,
      // Use a different object identity for note1 to make sure we do a
      // comparison before updating anything.
      actions.updateNoteList(context(1), [updatedNote])
    );

    expect(updatedState).toEqual([
      {
        ...noteState,
        note: {
          ...updatedNote,
        },
      },
    ]);
    // The object identity of the note state and its note should differ
    expect(updatedState[0]).not.toBe(noteState);
    expect(updatedState[0].note).not.toBe(noteState.note);
  });

  it('should NOT make update the note list if there are no changes on UPDATE_NOTE_LIST', () => {
    const noteState1 = typicalNoteState(1);
    const noteState2 = typicalNoteState(2);
    noteState2.note = { ...noteState2.note, id: 'def', content: 'Note 2' };
    const initialState = [noteState1, noteState2];

    const updatedState = subject(
      initialState,
      actions.updateNoteList(context(1), [
        { ...(noteState1.note as Note) },
        { ...(noteState2.note as Note) },
      ])
    );

    expect(updatedState).toBe(initialState);
    expect(updatedState[0]).toBe(noteState1);
    expect(updatedState[1]).toBe(noteState2);
  });

  it('should NOT update dirty fields or save state on UPDATE_NOTE_LIST', () => {
    const noteState1 = typicalNoteState(1);
    const noteState2 = typicalNoteState(2);
    noteState2.note = {
      ...noteState2.note,
      id: 'def',
      content: 'Change in progress',
    };
    noteState2.dirtyFields = new Set<keyof Note>(['content']);
    noteState2.saveState = SaveState.InProgress;
    const initialState = [noteState1, noteState2];

    const updatedState = subject(
      initialState,
      actions.updateNoteList(context(1), [
        noteState1.note as Note,
        {
          ...(noteState2.note as Note),
          content: 'Note 2',
        },
      ])
    );

    expect(updatedState).toEqual([
      noteState1,
      {
        ...noteState2,
        note: noteState2.note,
        dirtyFields: new Set<keyof Note>(['content']),
        saveState: SaveState.InProgress,
      },
    ]);
  });

  it('should NOT drop notes still being saved on UPDATE_NOTE_LIST', () => {
    const noteState1 = typicalNoteState(1);
    const noteState2 = typicalNoteState(2);
    noteState2.note = {
      ...noteState2.note,
      id: 'def',
      content: 'Note 2',
    };
    noteState2.saveState = SaveState.InProgress;
    const noteState3 = typicalNoteState(3);
    noteState3.note = {
      ...noteState3.note,
      id: 'ghi',
      content: 'Note 3',
    };
    const initialState = [noteState1, noteState2, noteState3];

    const updatedState = subject(
      initialState,
      actions.updateNoteList(context(1), [
        noteState1.note as Note,
        noteState3.note as Note,
      ])
    );

    expect(updatedState).toEqual([noteState1, noteState2, noteState3]);
    expect(updatedState[0]).toBe(noteState1);
    expect(updatedState[1]).toBe(noteState2);
    expect(updatedState[2]).toBe(noteState3);
  });

  it('should NOT drop dirty notes on UPDATE_NOTE_LIST', () => {
    const noteState1 = typicalNoteState(1);
    const noteState2 = typicalNoteState(2);
    noteState2.note = {
      ...noteState2.note,
      id: 'def',
      content: 'Note 2',
    };
    noteState2.dirtyFields = new Set<keyof Note>(['content']);
    const noteState3 = typicalNoteState(3);
    noteState3.note = {
      ...noteState3.note,
      id: 'ghi',
      content: 'Note 3',
    };
    noteState3.dirtyFields = new Set<keyof Note>(['keywords']);
    const initialState = [noteState1, noteState2, noteState3];

    const updatedState = subject(
      initialState,
      actions.updateNoteList(context(1), [noteState1.note as Note])
    );

    expect(updatedState).toEqual([noteState1, noteState2, noteState3]);
    expect(updatedState[0]).toBe(noteState1);
    expect(updatedState[1]).toBe(noteState2);
    expect(updatedState[2]).toBe(noteState3);
  });

  it('should mark notes as being created on ADD_NOTE', () => {
    // XXX
  });

  it('should NOT created notes on UPDATE_NOTE_LIST', () => {
    // XXX
  });

  it('should drop notes that no longer match on FINISH_SAVE_NOTE', () => {
    // XXX
  });
});
