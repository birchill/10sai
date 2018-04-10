/* global describe, expect, it */
/* eslint arrow-body-style: [ "off" ] */

import { edit as subject, EditState } from './reducer';
import EditorState from './EditorState';
import * as actions from './actions';
import { Card } from '../model';
import { CardChange } from '../store/cards/CardStore';
import { StoreError } from '../store/DataStore';
import { generateCard } from '../../test/testcommon';

const emptyState = (formId: actions.FormId): EditState => ({
  forms: {
    active: {
      formId,
      editorState: EditorState.EMPTY,
      card: {},
    },
  },
});

const okState = (
  card: Partial<Card>,
  dirtyFields?: Array<keyof Card>
): EditState => {
  const result: EditState = {
    forms: {
      active: {
        formId: card._id,
        editorState: EditorState.OK,
        card,
      },
    },
  };

  if (dirtyFields) {
    result.forms.active.dirtyFields = dirtyFields;
  }

  return result;
};

const loadingState = (formId: actions.FormId): EditState => ({
  forms: {
    active: {
      formId,
      editorState: EditorState.LOADING,
      card: {},
    },
  },
});

const dirtyState = (
  formId: actions.FormId,
  card: Partial<Card>,
  dirtyFields: Array<keyof Card>
): EditState => ({
  forms: {
    active: {
      formId,
      editorState: EditorState.DIRTY,
      card,
      dirtyFields,
    },
  },
});

const notFoundState = (formId, deleted) => ({
  forms: {
    active: {
      formId,
      editorState: EditorState.NOT_FOUND,
      card: {},
      deleted,
    },
  },
});

const withSaveError = (state: EditState, saveError: StoreError): EditState => ({
  ...state,
  saveError,
});

describe('reducer:edit', () => {
  it('should return the initial state', () => {
    const updatedState = subject(undefined, {} as any);

    expect(updatedState).toEqual(emptyState(0));
  });

  it('should update formId on NEW_CARD', () => {
    const updatedState = subject(undefined, actions.newCard(1));

    expect(updatedState).toEqual(emptyState(1));
  });

  it('should clear fields on NEW_CARD', () => {
    const initialState = okState(generateCard('abc'), ['question', 'answer']);

    const updatedState = subject(initialState, actions.newCard(2));

    expect(updatedState).toEqual(emptyState(2));
  });

  it('should update formId and state on LOAD_CARD', () => {
    const updatedState = subject(undefined, actions.loadCard('abc'));

    expect(updatedState).toEqual(loadingState('abc'));
  });

  it('should clear other state on LOAD_CARD', () => {
    const initialState = okState(generateCard('abc'), ['question', 'answer']);

    const updatedState = subject(initialState, actions.loadCard('def'));

    expect(updatedState).toEqual(loadingState('def'));
  });

  it('should update card info and state on FINISH_LOAD_CARD', () => {
    const initialState = loadingState('abc');
    const card = generateCard('abc');

    const updatedState = subject(
      initialState,
      actions.finishLoadCard('abc', card)
    );

    expect(updatedState).toEqual(okState(card));
  });

  it(
    'should NOT update card info and state on FINISH_SAVE_CARD if formIds' +
      ' differ',
    () => {
      const initialState = loadingState('abc');
      const card = generateCard('def');

      const updatedState = subject(
        initialState,
        actions.finishLoadCard('def', card)
      );

      expect(updatedState).toEqual(initialState);
    }
  );

  it('should update state on FAIL_LOAD_CARD', () => {
    const initialState = loadingState('abc');

    const updatedState = subject(
      initialState,
      actions.failLoadCard('abc', { name: 'Error', message: 'Error' })
    );

    expect(updatedState).toEqual(notFoundState('abc', false));
  });

  it('should NOT update state on FAIL_LOAD_CARD if formIds differ', () => {
    const initialState = loadingState('abc');

    const updatedState = subject(
      initialState,
      actions.failLoadCard('def', { name: 'Error', message: 'Error' })
    );

    expect(updatedState).toEqual(initialState);
  });

  it('should update to NOT_FOUND (deleted) state on FAIL_LOAD_CARD (deleted)', () => {
    const initialState = loadingState('abc');
    const error = { name: 'Error', message: 'Error', reason: 'deleted' };

    const updatedState = subject(
      initialState,
      actions.failLoadCard('abc', error)
    );

    expect(updatedState).toEqual(notFoundState('abc', true));
  });

  it('should update card and dirty fields and state on EDIT_CARD', () => {
    const initialState = okState({
      _id: 'abc',
      question: 'Question',
      answer: 'Answer',
    });
    const change = {
      _id: 'abc',
      question: 'Updated question',
      answer: 'Answer',
    };

    const updatedState = subject(initialState, actions.editCard('abc', change));

    expect(updatedState).toEqual(
      dirtyState(
        'abc',
        { _id: 'abc', question: 'Updated question', answer: 'Answer' },
        ['question']
      )
    );
  });

  it(
    'should update card and dirty fields and state on EDIT_CARD for new' +
      ' card',
    () => {
      const initialState = emptyState(7);
      const change = {
        question: 'Updated question',
        answer: 'Updated answer',
      };

      const updatedState = subject(initialState, actions.editCard(7, change));

      expect(updatedState).toEqual(
        dirtyState(
          7,
          { question: 'Updated question', answer: 'Updated answer' },
          ['question', 'answer']
        )
      );
    }
  );

  it(
    'should NOT update card and dirty fields and state on EDIT_CARD when' +
      ' formIds differ',
    () => {
      const initialState = okState({
        _id: 'abc',
        question: 'Question',
        answer: 'Answer',
      });

      const change = {
        _id: 'def',
        question: 'Updated question',
        answer: 'Answer',
      };
      const updatedState = subject(
        initialState,
        actions.editCard('def', change)
      );

      expect(updatedState).toEqual(initialState);
    }
  );

  it('should append set of dirty fields on subsequent on EDIT_CARD', () => {
    const initialState = dirtyState(
      'abc',
      { _id: 'abc', question: 'Updated question', answer: 'Answer' },
      ['question']
    );
    const change = { answer: 'Updated answer' };

    const updatedState = subject(initialState, actions.editCard('abc', change));

    expect(updatedState).toEqual(
      dirtyState(
        'abc',
        { _id: 'abc', question: 'Updated question', answer: 'Updated answer' },
        ['question', 'answer']
      )
    );
  });

  it('should update state on FINISH_SAVE_CARD', () => {
    const initialState = dirtyState(
      'abc',
      { _id: 'abc', question: 'Updated question', answer: 'Answer' },
      ['question']
    );
    const card = {
      _id: 'abc',
      question: 'Updated question',
      answer: 'Answer',
    };

    const updatedState = subject(
      initialState,
      actions.finishSaveCard('abc', card)
    );

    expect(updatedState).toEqual(
      okState({ _id: 'abc', question: 'Updated question', answer: 'Answer' })
    );
  });

  it(
    'should only update dirty-ness with regards to fields that have not' +
      ' since changed on FINISH_SAVE_CARD',
    () => {
      const initialState = dirtyState(
        'abc',
        { _id: 'abc', question: 'Updated #2', answer: 'Updated answer' },
        ['question', 'answer']
      );
      const card = {
        _id: 'abc',
        question: 'Updated #1',
        answer: 'Updated answer',
      };

      const updatedState = subject(
        initialState,
        actions.finishSaveCard('abc', card)
      );

      expect(updatedState).toEqual(
        dirtyState(
          'abc',
          { _id: 'abc', question: 'Updated #2', answer: 'Updated answer' },
          ['question']
        )
      );
    }
  );

  it('should NOT update state on FINISH_SAVE_CARD if formIds differ', () => {
    const initialState = dirtyState(
      'abc',
      { _id: 'abc', question: 'Updated question', answer: 'Answer' },
      ['question']
    );
    const card = {
      _id: 'def',
      question: 'Updated question',
      answer: 'Answer',
    };

    const updatedState = subject(
      initialState,
      actions.finishSaveCard('def', card)
    );

    expect(updatedState).toEqual(initialState);
  });

  it('should update state on FINISH_SAVE_CARD with new card', () => {
    const initialState = dirtyState(
      12,
      { question: 'Question', answer: 'Answer' },
      ['question', 'answer']
    );
    const card = {
      _id: 'abc',
      question: 'Question',
      answer: 'Answer',
    };

    const updatedState = subject(
      initialState,
      actions.finishSaveCard(12, card)
    );

    expect(updatedState).toEqual(
      okState({ _id: 'abc', question: 'Question', answer: 'Answer' })
    );
  });

  it(
    'should only update dirty-ness with regards to fields that have not' +
      ' since changed on FINISH_SAVE_CARD with new card',
    () => {
      const initialState = dirtyState(
        17,
        { question: 'Updated #1', answer: 'Updated #2' },
        ['question', 'answer']
      );
      const card = {
        _id: 'abc',
        question: 'Updated #1',
        answer: 'Updated #1',
      };

      const updatedState = subject(
        initialState,
        actions.finishSaveCard(17, card)
      );

      expect(updatedState).toEqual(
        dirtyState(
          'abc',
          { _id: 'abc', question: 'Updated #1', answer: 'Updated #2' },
          ['answer']
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
        { _id: 'abc', question: 'Question', answer: 'Answer' },
        ['question']
      );
      const card = {
        _id: 'def',
        question: 'Question',
        answer: 'Answer',
      };

      const updatedState = subject(
        initialState,
        actions.finishSaveCard('def', card)
      );

      expect(updatedState).toEqual(initialState);
    }
  );

  it('should NOT update state on FINISH_SAVE_CARD if the card is deleted', () => {
    // (This can happen if we have a stray auto-save task. In that case the
    // watchCardEdits saga needs to see that the card is deleted so that it goes
    // ahead and deletes the newly-saved card.)
    const initialState = notFoundState('abc', true);
    const card = {
      _id: 'abc',
      question: 'Question',
      answer: 'Answer',
    };

    const updatedState = subject(
      initialState,
      actions.finishSaveCard('abc', card)
    );

    expect(updatedState).toEqual(initialState);
  });

  it('should update save error message on FAIL_SAVE_CARD', () => {
    const initialState = dirtyState(
      'abc',
      { _id: 'abc', question: 'Question', answer: 'Answer' },
      ['question']
    );

    const updatedState = subject(
      initialState,
      actions.failSaveCard('abc', { name: 'bad', message: 'Bad bad bad' })
    );

    expect(updatedState).toEqual(
      withSaveError(
        dirtyState(
          'abc',
          { _id: 'abc', question: 'Question', answer: 'Answer' },
          ['question']
        ),
        { name: 'bad', message: 'Bad bad bad' }
      )
    );
  });

  it(
    'should NOT update save error message on FAIL_SAVE_CARD if formIds' +
      ' differ',
    () => {
      const initialState = dirtyState(
        'abc',
        { _id: 'abc', question: 'Question', answer: 'Answer' },
        ['question']
      );

      const updatedState = subject(
        initialState,
        actions.failSaveCard('def', { name: 'bad', message: 'Bad bad bad' })
      );

      expect(updatedState).toEqual(initialState);
    }
  );

  it('should NOT update state on FAIL_SAVE_CARD if the card is deleted', () => {
    const initialState = notFoundState('abc', true);

    const updatedState = subject(
      initialState,
      actions.failSaveCard('abc', { name: 'uhoh', message: 'Uh oh' })
    );

    expect(updatedState).toEqual(initialState);
  });

  it('should update non-dirty fields on SYNC_CARD', () => {
    const initialState = dirtyState(
      'abc',
      { _id: 'abc', question: 'Question A', answer: 'Answer' },
      ['question']
    );
    const change = {
      ...generateCard('abc'),
      question: 'Question B',
      answer: 'Answer B',
    };

    const updatedState = subject(initialState, actions.syncEditCard(change));

    expect(updatedState).toEqual(
      dirtyState('abc', { ...change, question: 'Question A' }, ['question'])
    );
  });

  it('should NOT update fields on SYNC_CARD when card IDs differ', () => {
    const initialState = dirtyState(
      'abc',
      { _id: 'abc', question: 'Question A', answer: 'Answer' },
      ['question']
    );
    const change = {
      ...generateCard('def'),
      question: 'Question B',
      answer: 'Answer B',
    };

    const updatedState = subject(initialState, actions.syncEditCard(change));

    expect(updatedState).toEqual(initialState);
  });

  it(
    'should update to NOT_FOUND (deleted) state on SYNC_CARD' +
      ' (_deleted: true)',
    () => {
      const initialState = dirtyState(
        'abc',
        { _id: 'abc', question: 'Question A', answer: 'Answer' },
        ['question']
      );
      const change: CardChange = {
        ...generateCard('abc'),
        _deleted: true,
      };

      const updatedState = subject(initialState, actions.syncEditCard(change));

      expect(updatedState).toEqual(notFoundState('abc', true));
    }
  );

  it('should update to NOT_FOUND (deleted) state on DELETE_EDIT_CARD', () => {
    const initialState = dirtyState(
      'abc',
      { _id: 'abc', question: 'Question', answer: 'Answer' },
      ['question']
    );

    const updatedState = subject(initialState, actions.deleteEditCard('abc'));

    expect(updatedState).toEqual(notFoundState('abc', true));
  });

  it('should update to EMPTY state on DELETE_EDIT_CARD for unsaved card', () => {
    const initialState = dirtyState(
      89,
      { question: 'Question', answer: 'Answer' },
      ['question']
    );

    const updatedState = subject(initialState, actions.deleteEditCard(89));

    expect(updatedState).toEqual(emptyState(89));
  });

  it('should do nothing on DELETE_EDIT_CARD if formId does nothing', () => {
    const initialState = dirtyState(
      'abc',
      { _id: 'abc', question: 'Question', answer: 'Answer' },
      ['question']
    );

    const updatedState = subject(initialState, actions.deleteEditCard('def'));

    expect(updatedState).toEqual(initialState);
  });
});
