import { notes as subject, NoteState } from './reducer';
import * as actions from './actions';
import { Note } from '../model';
import { Omit } from '../utils/type-helpers';
import { EditNoteContext } from './actions';

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
    const result: NoteState = { formId, note: {} };
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
    note: {
      id: 'abc',
      keywords: ['def', 'ghi'],
      content: 'Noterifictastical!',
      created: Date.now(),
      modified: Date.now(),
    },
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
        },
      ]);
    }
  );

  // TODO: If we decide to keep representing deleted notes (as opposed to simply
  // dropping them from the array) we should check that FINISH_SAVE_NOTE does
  // not update a deleted note.
});
