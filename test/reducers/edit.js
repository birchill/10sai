/* global describe, it */
/* eslint arrow-body-style: [ "off" ] */

import { assert } from 'chai';
import subject from '../../src/reducers/edit';
import EditState from '../../src/edit-states';
import * as actions from '../../src/actions/edit';

const emptyState = formId => ({
  forms: {
    active: {
      formId,
      editState: EditState.EMPTY,
      card: {},
    }
  }
});

const okState = (card, dirtyFields) => {
  const result = {
    forms: {
      active: {
        formId: card._id,
        editState: EditState.OK,
        card,
      }
    }
  };

  if (dirtyFields) {
    result.dirtyFields = dirtyFields;
  }

  return result;
};

const loadingState = formId => ({
  forms: {
    active: {
      formId,
      editState: EditState.LOADING,
      card: {},
    }
  }
});

const dirtyState = (formId, card, dirtyFields) => ({
  forms: {
    active: {
      formId,
      editState: EditState.DIRTY,
      card,
      dirtyFields,
    }
  }
});

const notFoundState = formId => ({
  forms: {
    active: {
      formId,
      editState: EditState.NOT_FOUND,
      card: {},
    }
  }
});

const withSaveError = (state, saveError) => ({ ...state, saveError });

describe('reducer:edit', () => {
  it('should return the initial state', () => {
    const updatedState = subject(undefined, {});

    assert.deepEqual(updatedState, emptyState(0));
  });

  it('should update formId on NEW_CARD', () => {
    const updatedState = subject(undefined, actions.newCard(1));

    assert.deepEqual(updatedState, emptyState(1));
  });

  it('should clear fields on NEW_CARD', () => {
    const initialState = okState(
      { _id: 'abc', prompt: 'yer' },
      [ 'prompt', 'answer' ]
    );

    const updatedState = subject(initialState, actions.newCard(2));

    assert.deepEqual(updatedState, emptyState(2));
  });

  it('should update formId and state on LOAD_CARD', () => {
    const updatedState = subject(undefined, actions.loadCard('abc'));

    assert.deepEqual(updatedState, loadingState('abc'));
  });

  it('should clear other state on LOAD_CARD', () => {
    const initialState = okState(
      { _id: 'abc', prompt: 'yer' },
      [ 'prompt', 'answer' ]
    );

    const updatedState = subject(initialState, actions.loadCard('def'));

    assert.deepEqual(updatedState, loadingState('def'));
  });

  it('should update card info and state on FINISH_LOAD_CARD', () => {
    const initialState = loadingState('abc');
    const card = {
      _id: 'abc',
      prompt: 'Prompt',
      answer: 'Answer',
    };

    const updatedState =
      subject(initialState, actions.finishLoadCard('abc', card));

    assert.deepEqual(updatedState, okState(card));
  });

  it('should NOT update card info and state on FINISH_SAVE_CARD if formIds'
     + ' differ', () => {
    const initialState = loadingState('abc');
    const card = {
      _id: 'def',
      prompt: 'Prompt',
      answer: 'Answer',
    };

    const updatedState = subject(initialState,
      actions.finishLoadCard('def', card));

    assert.deepEqual(updatedState, initialState);
  });

  it('should update state on FAIL_LOAD_CARD', () => {
    const initialState = loadingState('abc');

    const updatedState = subject(initialState, actions.failLoadCard('abc'));

    assert.deepEqual(updatedState, notFoundState('abc'));
  });

  it('should NOT update state on FAIL_LOAD_CARD if formIds differ', () => {
    const initialState = loadingState('abc');

    const updatedState = subject(initialState, actions.failLoadCard('def'));

    assert.deepEqual(updatedState, initialState);
  });

  it('should update card and dirty fields and state on EDIT_CARD', () => {
    const initialState = okState(
      { _id: 'abc', prompt: 'Prompt', answer: 'Answer' }
    );
    const change = {
      _id: 'abc',
      prompt: 'Updated prompt',
      answer: 'Answer'
    };

    const updatedState = subject(initialState, actions.editCard('abc', change));

    assert.deepEqual(updatedState, dirtyState('abc',
      { _id: 'abc', prompt: 'Updated prompt', answer: 'Answer' },
      [ 'prompt' ]
    ));
  });

  it('should update card and dirty fields and state on EDIT_CARD for new'
     + ' card', () => {
    const initialState = emptyState(7);
    const change = {
      prompt: 'Updated prompt',
      answer: 'Updated answer',
    };

    const updatedState = subject(initialState, actions.editCard(7, change));

    assert.deepEqual(updatedState, dirtyState(7,
      { prompt: 'Updated prompt', answer: 'Updated answer' },
      [ 'prompt', 'answer' ]
    ));
  });

  it('should NOT update card and dirty fields and state on EDIT_CARD when'
     + ' formIds differ', () => {
    const initialState = okState(
      { _id: 'abc', prompt: 'Prompt', answer: 'Answer' }
    );

    const change = {
      _id: 'def',
      prompt: 'Updated prompt',
      answer: 'Answer'
    };
    const updatedState = subject(initialState, actions.editCard('def', change));

    assert.deepEqual(updatedState, initialState);
  });

  it('should append set of dirty fields on subsequent on EDIT_CARD', () => {
    const initialState = dirtyState('abc',
      { _id: 'abc', prompt: 'Updated prompt', answer: 'Answer' },
      [ 'prompt' ]
    );
    const change = { answer: 'Updated answer' };

    const updatedState = subject(initialState, actions.editCard('abc', change));

    assert.deepEqual(updatedState, dirtyState('abc',
      { _id: 'abc', prompt: 'Updated prompt', answer: 'Updated answer' },
      [ 'prompt', 'answer' ]
    ));
  });

  it('should update state on FINISH_SAVE_CARD', () => {
    const initialState = dirtyState('abc',
      { _id: 'abc', prompt: 'Updated prompt', answer: 'Answer' },
      [ 'prompt' ]
    );
    const card = {
      _id: 'abc',
      prompt: 'Updated prompt',
      answer: 'Answer',
    };

    const updatedState =
      subject(initialState, actions.finishSaveCard('abc', card));

    assert.deepEqual(updatedState, okState(
      { _id: 'abc', prompt: 'Updated prompt', answer: 'Answer' }
    ));
  });

  it('should only update dirty-ness with regards to fields that have not'
     + ' since changed on FINISH_SAVE_CARD', () => {
    const initialState = dirtyState('abc',
      { _id: 'abc', prompt: 'Updated #2', answer: 'Updated answer' },
      [ 'prompt', 'answer' ]
    );
    const card = {
      _id: 'abc',
      prompt: 'Updated #1',
      answer: 'Updated answer',
    };

    const updatedState =
      subject(initialState, actions.finishSaveCard('abc', card));

    assert.deepEqual(updatedState, dirtyState('abc',
      { _id: 'abc', prompt: 'Updated #2', answer: 'Updated answer' },
      [ 'prompt' ]
    ));
  });

  it('should NOT update state on FINISH_SAVE_CARD if formIds differ', () => {
    const initialState = dirtyState('abc',
      { _id: 'abc', prompt: 'Updated prompt', answer: 'Answer' },
      [ 'prompt' ]
    );
    const card = {
      _id: 'def',
      prompt: 'Updated prompt',
      answer: 'Answer',
    };

    const updatedState =
      subject(initialState, actions.finishSaveCard('def', card));

    assert.deepEqual(updatedState, initialState);
  });

  it('should update state on FINISH_SAVE_CARD with new card', () => {
    const initialState = dirtyState(12,
      { prompt: 'Prompt', answer: 'Answer' },
      [ 'prompt', 'answer' ]
    );
    const card = {
      _id: 'abc',
      prompt: 'Prompt',
      answer: 'Answer',
    };

    const updatedState =
      subject(initialState, actions.finishSaveCard(12, card));

    assert.deepEqual(updatedState, okState(
      { _id: 'abc', prompt: 'Prompt', answer: 'Answer' }
    ));
  });

  it('should only update dirty-ness with regards to fields that have not'
     + ' since changed on FINISH_SAVE_CARD with new card', () => {
    const initialState = dirtyState(17,
      { prompt: 'Updated #1', answer: 'Updated #2' },
      [ 'prompt', 'answer' ]
    );
    const card = {
      _id: 'abc',
      prompt: 'Updated #1',
      answer: 'Updated #1',
    };

    const updatedState =
      subject(initialState, actions.finishSaveCard(17, card));

    assert.deepEqual(updatedState, dirtyState('abc',
      { _id: 'abc', prompt: 'Updated #1', answer: 'Updated #2' },
      [ 'answer' ]
    ));
  });

  it('should NOT update state on FINISH_SAVE_CARD with new card if formIds'
     + ' differ', () => {
    const initialState = dirtyState(12,
      { _id: 'abc', prompt: 'Prompt', answer: 'Answer' },
      [ 'prompt' ]
    );
    const card = {
      _id: 'def',
      prompt: 'Prompt',
      answer: 'Answer',
    };

    const updatedState =
      subject(initialState, actions.finishSaveCard('def', card));

    assert.deepEqual(updatedState, initialState);
  });

  it('should update save error message on FAIL_SAVE_CARD', () => {
    const initialState = dirtyState('abc',
      { _id: 'abc', prompt: 'Prompt', answer: 'Answer' },
      [ 'prompt' ]
    );

    const updatedState =
      subject(initialState, actions.failSaveCard('abc', 'Bad bad bad'));

    assert.deepEqual(updatedState, withSaveError(dirtyState('abc',
      { _id: 'abc', prompt: 'Prompt', answer: 'Answer' },
      [ 'prompt' ]
    ), 'Bad bad bad'));
  });

  it('should NOT update save error message on FAIL_SAVE_CARD if formIds'
     + ' differ', () => {
    const initialState = dirtyState('abc',
      { _id: 'abc', prompt: 'Prompt', answer: 'Answer' },
      [ 'prompt' ]
    );

    const updatedState =
      subject(initialState, actions.failSaveCard('def', 'Bad bad bad'));

    assert.deepEqual(updatedState, initialState);
  });

  it('should update non-dirty fields on SYNC_CARD', () => {
    const initialState = dirtyState('abc',
      { _id: 'abc', prompt: 'Prompt A', answer: 'Answer' },
      [ 'prompt' ]
    );
    const card = {
      _id: 'abc',
      prompt: 'Prompt B',
      answer: 'Answer B',
    };

    const updatedState =
      subject(initialState, actions.syncCard(card));

    assert.deepEqual(updatedState, dirtyState('abc',
      { _id: 'abc', prompt: 'Prompt A', answer: 'Answer B' },
      [ 'prompt' ]
    ));
  });

  it('should NOT update fields on SYNC_CARD when card IDs differ', () => {
    const initialState = dirtyState('abc',
      { _id: 'abc', prompt: 'Prompt A', answer: 'Answer' },
      [ 'prompt' ]
    );
    const card = {
      _id: 'def',
      prompt: 'Prompt B',
      answer: 'Answer B',
    };

    const updatedState =
      subject(initialState, actions.syncCard(card));

    assert.deepEqual(updatedState, initialState);
  });
});
