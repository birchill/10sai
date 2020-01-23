import { edit as subject, EditState, SaveState } from './reducer';
import { FormState } from './FormState';
import * as Actions from '../actions';
import { Card } from '../model';
import { CardChange } from '../store/CardStore';
import { StoreError } from '../store/DataStore';
import { generateCard } from '../utils/testing';

const emptyState = (newFormId: number): EditState => ({
  forms: {
    active: {
      formId: newFormId,
      formState: FormState.Ok,
      card: {},
      notes: [],
      saveState: SaveState.New,
    },
  },
  newCardTags: [],
});

const okState = (
  formId: number,
  card: Partial<Card>,
  dirtyFields?: Set<keyof Card>
): EditState => {
  const result: EditState = {
    forms: {
      active: {
        formId,
        formState: FormState.Ok,
        card,
        notes: [],
        saveState: SaveState.Ok,
      },
    },
    newCardTags: [],
  };

  if (dirtyFields) {
    result.forms.active.dirtyFields = dirtyFields;
  }

  return result;
};

const loadingState = (newFormId: number): EditState => ({
  forms: {
    active: {
      formId: newFormId,
      formState: FormState.Loading,
      card: {},
      notes: [],
      saveState: SaveState.Ok,
    },
  },
  newCardTags: [],
});

const dirtyState = (
  formId: number,
  card: Partial<Card>,
  dirtyFields: Set<keyof Card>,
  isNew: boolean = false
): EditState => ({
  forms: {
    active: {
      formId,
      formState: FormState.Ok,
      card,
      dirtyFields,
      notes: [],
      saveState: isNew ? SaveState.New : SaveState.Ok,
    },
  },
  newCardTags: [],
});

const notFoundState = (formId: number): EditState => ({
  forms: {
    active: {
      formId,
      formState: FormState.NotFound,
      card: {},
      notes: [],
      saveState: SaveState.Ok,
    },
  },
  newCardTags: [],
});

const deletedState = (formId: number): EditState => ({
  forms: {
    active: {
      formId,
      formState: FormState.Deleted,
      card: {},
      notes: [],
      saveState: SaveState.Ok,
    },
  },
  newCardTags: [],
});

const withSaveError = (state: EditState, saveError: StoreError): EditState => ({
  forms: {
    active: {
      ...state.forms.active,
      saveState: SaveState.Error,
      saveError,
    },
  },
  newCardTags: [],
});

const toDirtyFields = (...fields: Array<keyof Card>): Set<keyof Card> =>
  new Set(fields);

describe('reducer:edit', () => {
  it('should return the initial state', () => {
    const updatedState = subject(undefined, {} as any);

    expect(updatedState).toEqual(emptyState(0));
  });

  it('should update formId on NEW_CARD', () => {
    const updatedState = subject(undefined, Actions.newCard(undefined, 1));

    expect(updatedState).toEqual(emptyState(1));
  });

  it('should clear fields on NEW_CARD', () => {
    const initialState = okState(
      1,
      generateCard('abc'),
      toDirtyFields('front', 'back')
    );

    const updatedState = subject(initialState, Actions.newCard(undefined, 2));

    expect(updatedState).toEqual(emptyState(2));
  });

  it('should add the new tags to a NEW_CARD if set', () => {
    const initialState = emptyState(4);

    // Set some tags to apply to the next card
    let updatedState = subject(initialState, Actions.newCard(undefined, 5));
    updatedState = subject(
      updatedState,
      Actions.editCard(5, { tags: ['Tag 1', 'Tag 2'] })
    );

    updatedState = subject(updatedState, Actions.newCard(undefined, 6));

    expect(updatedState.forms.active.card.tags).toEqual(['Tag 1', 'Tag 2']);
  });

  it('should apply any specified fields on NEW_CARD', () => {
    const updatedState = subject(
      undefined,
      Actions.newCard(
        {
          front: 'Front',
          back: 'Back',
          keywords: ['One', 'Two'],
          tags: ['Tag 1', 'Tag 2'],
        },
        6
      )
    );

    expect(updatedState.forms.active.card).toEqual({
      front: 'Front',
      back: 'Back',
      keywords: ['One', 'Two'],
      tags: ['Tag 1', 'Tag 2'],
    });
  });

  it('should overwrite any previous tags with ones specified in the NEW_CARD action', () => {
    const initialState = emptyState(7);

    // Set some tags to apply to the next card
    let updatedState = subject(initialState, Actions.newCard(undefined, 8));
    updatedState = subject(
      updatedState,
      Actions.editCard(8, { tags: ['Tag 1', 'Tag 2'] })
    );
    expect(updatedState.newCardTags).toEqual(['Tag 1', 'Tag 2']);

    // Create a new card where tags are specified
    updatedState = subject(
      initialState,
      Actions.newCard({ tags: ['Tag 3', 'Tag 4'] }, 9)
    );

    expect(updatedState.forms.active.card.tags).toEqual(['Tag 3', 'Tag 4']);
  });

  it('should update formId and state on LOAD_CARD', () => {
    const updatedState = subject(undefined, Actions.loadCard('abc', 2));

    expect(updatedState).toEqual(loadingState(2));
  });

  it('should clear other state on LOAD_CARD', () => {
    const initialState = okState(
      2,
      generateCard('abc'),
      toDirtyFields('front', 'back')
    );

    const updatedState = subject(initialState, Actions.loadCard('def', 3));

    expect(updatedState).toEqual(loadingState(3));
  });

  it('should update card info and state on FINISH_LOAD_CARD', () => {
    const initialState = loadingState(5);
    const card = generateCard('abc');

    const updatedState = subject(initialState, Actions.finishLoadCard(5, card));

    expect(updatedState).toEqual(okState(5, card));
  });

  it(
    'should NOT update card info and state on FINISH_LOAD_CARD if formIds' +
      ' differ',
    () => {
      const initialState = loadingState(7);
      const card = generateCard('def');

      const updatedState = subject(
        initialState,
        Actions.finishLoadCard(8, card)
      );

      expect(updatedState).toEqual(initialState);
    }
  );

  it('should update state on FAIL_LOAD_CARD', () => {
    const initialState = loadingState(7);

    const updatedState = subject(
      initialState,
      Actions.failLoadCard(7, { name: 'Error', message: 'Error' })
    );

    expect(updatedState).toEqual(notFoundState(7));
  });

  it('should NOT update state on FAIL_LOAD_CARD if formIds differ', () => {
    const initialState = loadingState(8);

    const updatedState = subject(
      initialState,
      Actions.failLoadCard(9, { name: 'Error', message: 'Error' })
    );

    expect(updatedState).toEqual(initialState);
  });

  it('should update to deleted state on FAIL_LOAD_CARD (deleted)', () => {
    const initialState = loadingState(8);
    const error = { name: 'Error', message: 'Error', reason: 'deleted' };

    const updatedState = subject(initialState, Actions.failLoadCard(8, error));

    expect(updatedState).toEqual(deletedState(8));
  });

  it('should update card and dirty fields and state on EDIT_CARD', () => {
    const initialState = okState(4, {
      id: 'abc',
      front: 'Question',
      back: 'Answer',
    });
    const change = {
      id: 'abc',
      front: 'Updated question',
      back: 'Answer',
    };

    const updatedState = subject(initialState, Actions.editCard(4, change));

    expect(updatedState).toEqual(
      dirtyState(
        4,
        { id: 'abc', front: 'Updated question', back: 'Answer' },
        toDirtyFields('front')
      )
    );
  });

  it(
    'should update card and dirty fields and state on EDIT_CARD for new' +
      ' card',
    () => {
      const initialState = emptyState(7);
      const change = {
        front: 'Updated question',
        back: 'Updated answer',
      };

      const updatedState = subject(initialState, Actions.editCard(7, change));

      expect(updatedState).toEqual(
        dirtyState(
          7,
          { front: 'Updated question', back: 'Updated answer' },
          toDirtyFields('front', 'back'),
          true
        )
      );
    }
  );

  it(
    'should NOT update card and dirty fields and state on EDIT_CARD when' +
      ' formIds differ',
    () => {
      const initialState = okState(4, {
        id: 'abc',
        front: 'Question',
        back: 'Answer',
      });

      const change = {
        id: 'def',
        front: 'Updated question',
        back: 'Answer',
      };
      const updatedState = subject(initialState, Actions.editCard(5, change));

      expect(updatedState).toEqual(initialState);
    }
  );

  it('should append set of dirty fields on subsequent on EDIT_CARD', () => {
    const initialState = dirtyState(
      6,
      { id: 'abc', front: 'Updated question', back: 'Answer' },
      toDirtyFields('front')
    );
    const change = { back: 'Updated answer' };

    const updatedState = subject(initialState, Actions.editCard(6, change));

    expect(updatedState).toEqual(
      dirtyState(
        6,
        { id: 'abc', front: 'Updated question', back: 'Updated answer' },
        toDirtyFields('front', 'back')
      )
    );
  });

  it('should preserve new card tags on EDIT_CARD', () => {
    const initialState = emptyState(7);

    let updatedState = subject(initialState, Actions.newCard(undefined, 8));
    updatedState = subject(
      updatedState,
      Actions.editCard(8, { tags: ['Tag 1', 'Tag 2'] })
    );
    expect(updatedState.newCardTags).toEqual(['Tag 1', 'Tag 2']);

    updatedState = subject(
      updatedState,
      Actions.editCard(8, { front: 'Question' })
    );
    expect(updatedState.newCardTags).toEqual(['Tag 1', 'Tag 2']);
  });

  it('should clear the saveError on SAVE_CARD', () => {
    const withoutErrorState = dirtyState(
      11,
      { id: 'abc', front: 'Updated question', back: 'Answer' },
      toDirtyFields('front')
    );
    withoutErrorState.forms.active.saveState = SaveState.InProgress;

    const initialState = withSaveError(withoutErrorState, {
      name: 'bad',
      message: 'Bad bad bad',
    });

    const updatedState = subject(initialState, Actions.saveCard(11));

    expect(updatedState).toEqual(withoutErrorState);
  });

  it('should update state on FINISH_SAVE_CARD', () => {
    const initialState = dirtyState(
      11,
      { id: 'abc', front: 'Updated question', back: 'Answer' },
      toDirtyFields('front')
    );
    const card = {
      id: 'abc',
      front: 'Updated question',
      back: 'Answer',
    };

    const updatedState = subject(
      initialState,
      Actions.finishSaveCard(11, card)
    );

    expect(updatedState).toEqual(
      okState(11, {
        id: 'abc',
        front: 'Updated question',
        back: 'Answer',
      })
    );
  });

  it(
    'should only update dirty-ness with regards to fields that have not' +
      ' since changed on FINISH_SAVE_CARD',
    () => {
      const initialState = dirtyState(
        12,
        { id: 'abc', front: 'Updated #2', back: 'Updated answer' },
        toDirtyFields('front', 'back')
      );
      const card = {
        id: 'abc',
        front: 'Updated #1',
        back: 'Updated answer',
      };

      const updatedState = subject(
        initialState,
        Actions.finishSaveCard(12, card)
      );

      expect(updatedState).toEqual(
        dirtyState(
          12,
          { id: 'abc', front: 'Updated #2', back: 'Updated answer' },
          toDirtyFields('front')
        )
      );
    }
  );

  it('should NOT update state on FINISH_SAVE_CARD if formIds differ', () => {
    const initialState = dirtyState(
      12,
      { id: 'abc', front: 'Updated question', back: 'Answer' },
      toDirtyFields('front')
    );
    const card = {
      id: 'def',
      front: 'Updated question',
      back: 'Answer',
    };

    const updatedState = subject(
      initialState,
      Actions.finishSaveCard(13, card)
    );

    expect(updatedState).toEqual(initialState);
  });

  it('should update state on FINISH_SAVE_CARD with new card', () => {
    const initialState = dirtyState(
      12,
      { front: 'Question', back: 'Answer' },
      toDirtyFields('front', 'back')
    );
    const card = {
      id: 'abc',
      front: 'Question',
      back: 'Answer',
    };

    const updatedState = subject(
      initialState,
      Actions.finishSaveCard(12, card)
    );

    expect(updatedState).toEqual(
      okState(12, { id: 'abc', front: 'Question', back: 'Answer' })
    );
  });

  it(
    'should only update dirty-ness with regards to fields that have not' +
      ' since changed on FINISH_SAVE_CARD with new card',
    () => {
      const initialState = dirtyState(
        17,
        { front: 'Updated #1', back: 'Updated #2' },
        toDirtyFields('front', 'back')
      );
      const card = {
        id: 'abc',
        front: 'Updated #1',
        back: 'Updated #1',
      };

      const updatedState = subject(
        initialState,
        Actions.finishSaveCard(17, card)
      );

      expect(updatedState).toEqual(
        dirtyState(
          17,
          { id: 'abc', front: 'Updated #1', back: 'Updated #2' },
          toDirtyFields('back')
        )
      );
    }
  );

  it(
    'should NOT update state on FINISH_SAVE_CARD with new card if formIds' +
      ' differ',
    () => {
      const initialState = dirtyState(
        12,
        { id: 'abc', front: 'Question', back: 'Answer' },
        toDirtyFields('front')
      );
      const card = {
        id: 'def',
        front: 'Question',
        back: 'Answer',
      };

      const updatedState = subject(
        initialState,
        Actions.finishSaveCard(11, card)
      );

      expect(updatedState).toEqual(initialState);
    }
  );

  it('should NOT update state on FINISH_SAVE_CARD if the card is deleted', () => {
    // (This can happen if we have a stray auto-save task. In that case the
    // watchCardEdits saga needs to see that the card is deleted so that it goes
    // ahead and deletes the newly-saved card.)
    const initialState = deletedState(15);
    const card = {
      id: 'abc',
      front: 'Question',
      back: 'Answer',
    };

    const updatedState = subject(
      initialState,
      Actions.finishSaveCard(15, card)
    );

    expect(updatedState).toEqual(initialState);
  });

  it('should update save error message on FAIL_SAVE_CARD', () => {
    const initialState = dirtyState(
      15,
      { id: 'abc', front: 'Question', back: 'Answer' },
      toDirtyFields('front')
    );

    const updatedState = subject(
      initialState,
      Actions.failSaveCard(15, { name: 'bad', message: 'Bad bad bad' })
    );

    expect(updatedState).toEqual(
      withSaveError(initialState, { name: 'bad', message: 'Bad bad bad' })
    );
  });

  it(
    'should NOT update save error message on FAIL_SAVE_CARD if formIds' +
      ' differ',
    () => {
      const initialState = dirtyState(
        16,
        { id: 'abc', front: 'Question', back: 'Answer' },
        toDirtyFields('front')
      );

      const updatedState = subject(
        initialState,
        Actions.failSaveCard(15, { name: 'bad', message: 'Bad bad bad' })
      );

      expect(updatedState).toEqual(initialState);
    }
  );

  it('should NOT update state on FAIL_SAVE_CARD if the card is deleted', () => {
    const initialState = deletedState(15);

    const updatedState = subject(
      initialState,
      Actions.failSaveCard(15, { name: 'uhoh', message: 'Uh oh' })
    );

    expect(updatedState).toEqual(initialState);
  });

  it('should update non-dirty fields on SYNC_CARD', () => {
    const initialState = dirtyState(
      15,
      { id: 'abc', front: 'Question A', back: 'Answer' },
      toDirtyFields('front')
    );
    const change: CardChange = {
      card: {
        ...generateCard('abc'),
        front: 'Question B',
        back: 'Answer B',
      },
    };

    const updatedState = subject(initialState, Actions.syncEditCard(change));

    expect(updatedState).toEqual(
      dirtyState(
        15,
        { ...change.card, front: 'Question A' },
        toDirtyFields('front')
      )
    );
  });

  it('should NOT update fields on SYNC_CARD when card IDs differ', () => {
    const initialState = dirtyState(
      15,
      { id: 'abc', front: 'Question A', back: 'Answer' },
      toDirtyFields('front')
    );
    const change: CardChange = {
      card: {
        ...generateCard('def'),
        front: 'Question B',
        back: 'Answer B',
      },
    };

    const updatedState = subject(initialState, Actions.syncEditCard(change));

    expect(updatedState).toEqual(initialState);
  });

  it(
    'should update to NOT_FOUND (deleted) state on SYNC_CARD' +
      ' (deleted: true)',
    () => {
      const initialState = dirtyState(
        15,
        { id: 'abc', front: 'Question A', back: 'Answer' },
        toDirtyFields('front')
      );
      const change: CardChange = {
        card: generateCard('abc'),
        deleted: true,
      };

      const updatedState = subject(initialState, Actions.syncEditCard(change));

      expect(updatedState).toEqual(deletedState(15));
    }
  );

  it('should update to NOT_FOUND (deleted) state on DELETE_CARD', () => {
    const initialState = dirtyState(
      15,
      { id: 'abc', front: 'Question', back: 'Answer' },
      toDirtyFields('front')
    );

    const updatedState = subject(initialState, Actions.deleteCard(15, 'abc'));

    expect(updatedState).toEqual(deletedState(15));
  });

  it('should update to EMPTY state on DELETE_CARD for unsaved card', () => {
    const initialState = dirtyState(
      89,
      { front: 'Question', back: 'Answer' },
      toDirtyFields('front')
    );

    const updatedState = subject(initialState, Actions.deleteCard(89));

    expect(updatedState).toEqual(emptyState(89));
  });

  it('should do nothing on DELETE_CARD if formId does not match', () => {
    const initialState = dirtyState(
      16,
      { id: 'abc', front: 'Question', back: 'Answer' },
      toDirtyFields('front')
    );

    const updatedState = subject(initialState, Actions.deleteCard(15, 'abc'));

    expect(updatedState).toEqual(initialState);
  });

  it('should update notes when the context matches', () => {
    const initialState = emptyState(7);

    const updatedState = subject(
      initialState,
      Actions.addNote({ screen: 'edit-card', cardFormId: 7 })
    );

    expect(updatedState.forms.active.notes).toHaveLength(1);
  });

  it('should do nothing on ADD_NOTE if formId does not match', () => {
    const initialState = emptyState(7);

    const updatedState = subject(
      initialState,
      Actions.addNote({ screen: 'edit-card', cardFormId: 6 })
    );

    expect(updatedState).toEqual(initialState);
  });
});
