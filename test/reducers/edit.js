/* global describe, it */
/* eslint arrow-body-style: [ "off" ] */

import { assert } from 'chai';
import subject from '../../src/reducers/edit';
import EditState from '../../src/edit-states';
import * as actions from '../../src/actions/edit';

describe('reducer:edit', () => {
  it('should return the initial state', () => {
    const updatedState = subject(undefined, {});
    assert.deepEqual(updatedState,
      {
        forms: {
          active: {
            formId: 0,
            editState: EditState.EMPTY,
            card: {},
          }
        }
      }
    );
  });

  it('should update formId on NEW_CARD', () => {
    const updatedState = subject(undefined, actions.newCard());

    assert.deepEqual(updatedState,
      {
        forms: {
          active: {
            formId: 1,
            editState: EditState.EMPTY,
            card: {},
          }
        }
      }
    );
  });

  it('should clear fields on NEW_CARD', () => {
    const initialState = {
      forms: {
        active: {
          formId: 'abc',
          editState: EditState.OK,
          card: { _id: 'abc', prompt: 'yer' },
          dirtyFields: [ 'prompt', 'question' ],
        }
      }
    };

    const updatedState = subject(initialState, actions.newCard());

    assert.deepEqual(updatedState,
      {
        forms: {
          active: {
            formId: 2,
            editState: EditState.EMPTY,
            card: {},
          }
        }
      }
    );
  });

  it('should update formId and state on LOAD_CARD', () => {
    const updatedState = subject(undefined, actions.loadCard('abc'));

    assert.deepEqual(updatedState,
      {
        forms: {
          active: {
            formId: 'abc',
            editState: EditState.LOADING,
            card: {},
          }
        }
      }
    );
  });

  it('should clear other state on LOAD_CARD', () => {
    const initialState = {
      forms: {
        active: {
          formId: 'abc',
          editState: EditState.OK,
          card: { _id: 'abc', prompt: 'yer' },
          dirtyFields: [ 'prompt', 'question' ],
        }
      }
    };

    const updatedState = subject(initialState, actions.loadCard('def'));

    assert.deepEqual(updatedState,
      {
        forms: {
          active: {
            formId: 'def',
            editState: EditState.LOADING,
            card: {},
          }
        }
      }
    );
  });

  it('should update card info and state on FINISH_LOAD_CARD', () => {
    const initialState = {
      forms: {
        active: {
          formId: 'abc',
          editState: EditState.LOADING,
          card: { },
        }
      }
    };
    const card = {
      _id: 'abc',
      prompt: 'Prompt',
      answer: 'Answer',
    };

    const updatedState =
      subject(initialState, actions.finishLoadCard('abc', card));

    assert.deepEqual(updatedState,
      {
        forms: {
          active: {
            formId: 'abc',
            editState: EditState.OK,
            card,
          }
        }
      }
    );
  });

  it('should NOT update card info and state on FINISH_SAVE_CARD if formIds'
     + ' differ', () => {
    const initialState = {
      forms: {
        active: {
          formId: 'abc',
          editState: EditState.LOADING,
          card: { },
        }
      }
    };
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
    const initialState = {
      forms: {
        active: {
          formId: 'abc',
          editState: EditState.LOADING,
          card: { },
        }
      }
    };

    const updatedState = subject(initialState, actions.failLoadCard('abc'));

    assert.deepEqual(updatedState,
      {
        forms: {
          active: {
            formId: 'abc',
            editState: EditState.NOT_FOUND,
            card: { },
          }
        }
      }
    );
  });

  it('should NOT update state on FAIL_LOAD_CARD if formIds differ', () => {
    const initialState = {
      forms: {
        active: {
          formId: 'abc',
          editState: EditState.LOADING,
          card: { },
        }
      }
    };

    const updatedState = subject(initialState, actions.failLoadCard('def'));

    assert.deepEqual(updatedState, initialState);
  });

  it('should update card and dirty fields and state on EDIT_CARD', () => {
    const initialState = {
      forms: {
        active: {
          formId: 'abc',
          editState: EditState.OK,
          card: {
            _id: 'abc',
            prompt: 'Prompt',
            answer: 'Answer',
          }
        }
      }
    };

    const change = {
      _id: 'abc',
      prompt: 'Updated prompt',
      answer: 'Answer'
    };
    const updatedState = subject(initialState, actions.editCard('abc', change));

    assert.deepEqual(updatedState,
      {
        forms: {
          active: {
            formId: 'abc',
            editState: EditState.DIRTY_EDIT,
            card: {
              _id: 'abc',
              prompt: 'Updated prompt',
              answer: 'Answer',
            },
            dirtyFields: [ 'prompt' ],
          }
        }
      }
    );
  });

  it('should update card and dirty fields and state on EDIT_CARD for new'
     + ' card', () => {
    const initialState = {
      forms: {
        active: {
          formId: 7,
          editState: EditState.EMPTY,
          card: { }
        }
      }
    };

    const change = {
      prompt: 'Updated prompt',
      answer: 'Updated answer',
    };
    const updatedState = subject(initialState, actions.editCard(7, change));

    assert.deepEqual(updatedState,
      {
        forms: {
          active: {
            formId: 7,
            editState: EditState.DIRTY_NEW,
            card: {
              prompt: 'Updated prompt',
              answer: 'Updated answer',
            },
            dirtyFields: [ 'prompt', 'answer' ],
          }
        }
      }
    );
  });

  it('should NOT update card and dirty fields and state on EDIT_CARD when'
     + ' formIds differ', () => {
    const initialState = {
      forms: {
        active: {
          formId: 'abc',
          editState: EditState.OK,
          card: {
            _id: 'abc',
            prompt: 'Prompt',
            answer: 'Answer',
          }
        }
      }
    };

    const change = {
      _id: 'def',
      prompt: 'Updated prompt',
      answer: 'Answer'
    };
    const updatedState = subject(initialState, actions.editCard('def', change));

    assert.deepEqual(updatedState, initialState);
  });

  it('should update state on FINISH_SAVE_CARD', () => {
    const initialState = {
      forms: {
        active: {
          formId: 'abc',
          editState: EditState.DIRTY_EDIT,
          card: {
            _id: 'abc',
            prompt: 'Updated prompt',
            answer: 'Answer',
          },
          dirtyFields: [ 'prompt' ],
        }
      }
    };
    const card = {
      _id: 'abc',
      prompt: 'Updated prompt',
      answer: 'Answer',
    };

    const updatedState =
      subject(initialState, actions.finishSaveCard('abc', card));

    assert.deepEqual(updatedState,
      {
        forms: {
          active: {
            formId: 'abc',
            editState: EditState.OK,
            card: {
              _id: 'abc',
              prompt: 'Updated prompt',
              answer: 'Answer',
            },
          }
        }
      }
    );
  });

  it('should only update dirty-ness with regards to fields that have not'
     + ' since changed on FINISH_SAVE_CARD', () => {
    const initialState = {
      forms: {
        active: {
          formId: 'abc',
          editState: EditState.DIRTY_EDIT,
          card: {
            _id: 'abc',
            prompt: 'Updated #2',
            answer: 'Updated answer',
          },
          dirtyFields: [ 'prompt', 'answer' ],
        }
      }
    };
    const card = {
      _id: 'abc',
      prompt: 'Updated #1',
      answer: 'Updated answer',
    };

    const updatedState =
      subject(initialState, actions.finishSaveCard('abc', card));

    assert.deepEqual(updatedState,
      {
        forms: {
          active: {
            formId: 'abc',
            editState: EditState.DIRTY_EDIT,
            card: {
              _id: 'abc',
              prompt: 'Updated #2',
              answer: 'Updated answer',
            },
            dirtyFields: [ 'prompt' ],
          }
        }
      }
    );
  });

  it('should NOT update state on FINISH_SAVE_CARD if formIds differ', () => {
    const initialState = {
      forms: {
        active: {
          formId: 'abc',
          editState: EditState.DIRTY_EDIT,
          card: {
            _id: 'abc',
            prompt: 'Updated prompt',
            answer: 'Answer',
          },
          dirtyFields: [ 'prompt' ],
        }
      }
    };
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
    const initialState = {
      forms: {
        active: {
          formId: 12,
          editState: EditState.DIRTY_NEW,
          card: {
            prompt: 'Prompt',
            answer: 'Answer',
          },
          dirtyFields: [ 'prompt', 'answer' ],
        }
      }
    };
    const card = {
      _id: 'abc',
      prompt: 'Prompt',
      answer: 'Answer',
    };

    const updatedState =
      subject(initialState, actions.finishSaveCard(12, card));

    assert.deepEqual(updatedState,
      {
        forms: {
          active: {
            formId: 'abc',
            editState: EditState.OK,
            card: {
              _id: 'abc',
              prompt: 'Prompt',
              answer: 'Answer',
            },
          }
        }
      }
    );
  });

  it('should only update dirty-ness with regards to fields that have not'
     + ' since changed on FINISH_SAVE_CARD with new card', () => {
    const initialState = {
      forms: {
        active: {
          formId: 17,
          editState: EditState.DIRTY_NEW,
          card: {
            prompt: 'Updated #1',
            answer: 'Updated #2',
          },
          dirtyFields: [ 'prompt', 'answer' ],
        }
      }
    };
    const card = {
      _id: 'abc',
      prompt: 'Updated #1',
      answer: 'Updated #1',
    };

    const updatedState =
      subject(initialState, actions.finishSaveCard(17, card));

    assert.deepEqual(updatedState,
      {
        forms: {
          active: {
            formId: 'abc',
            editState: EditState.DIRTY_NEW,
            card: {
              _id: 'abc',
              prompt: 'Updated #1',
              answer: 'Updated #2',
            },
            dirtyFields: [ 'answer' ],
          }
        }
      }
    );
  });

  it('should NOT update state on FINISH_SAVE_CARD with new card if formIds'
     + ' differ', () => {
    const initialState = {
      forms: {
        active: {
          formId: 'abc',
          editState: EditState.DIRTY_NEW,
          card: {
            _id: 'abc',
            prompt: 'Prompt',
            answer: 'Answer',
          },
          dirtyFields: [ 'prompt' ],
        }
      }
    };
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
    const initialState = {
      forms: {
        active: {
          formId: 'abc',
          editState: EditState.DIRTY_EDIT,
          card: {
            _id: 'abc',
            prompt: 'Prompt',
            answer: 'Answer',
          },
          dirtyFields: [ 'prompt' ],
        }
      }
    };

    const updatedState =
      subject(initialState, actions.failSaveCard('abc', 'Bad bad bad'));

    assert.deepEqual(updatedState,
      {
        forms: {
          active: {
            formId: 'abc',
            editState: EditState.DIRTY_EDIT,
            card: {
              _id: 'abc',
              prompt: 'Prompt',
              answer: 'Answer',
            },
            dirtyFields: [ 'prompt' ],
          }
        },
        saveError: 'Bad bad bad',
      }
    );
  });

  it('should NOT update save error message on FAIL_SAVE_CARD if formIds'
     + ' differ', () => {
    const initialState = {
      forms: {
        active: {
          formId: 'abc',
          editState: EditState.DIRTY_EDIT,
          card: {
            _id: 'abc',
            prompt: 'Prompt',
            answer: 'Answer',
          },
          dirtyFields: [ 'prompt' ],
        }
      }
    };

    const updatedState =
      subject(initialState, actions.failSaveCard('def', 'Bad bad bad'));

    assert.deepEqual(updatedState, initialState);
  });

  it('should update non-dirty fields on SYNC_CARD', () => {
    const initialState = {
      forms: {
        active: {
          formId: 'abc',
          editState: EditState.DIRTY_EDIT,
          card: {
            _id: 'abc',
            prompt: 'Prompt A',
            answer: 'Answer',
          },
          dirtyFields: [ 'prompt' ],
        }
      }
    };
    const card = {
      _id: 'abc',
      prompt: 'Prompt B',
      answer: 'Answer B',
    };

    const updatedState =
      subject(initialState, actions.syncCard('abc', card));

    assert.deepEqual(updatedState,
      {
        forms: {
          active: {
            formId: 'abc',
            editState: EditState.DIRTY_EDIT,
            card: {
              _id: 'abc',
              prompt: 'Prompt A',
              answer: 'Answer B',
            },
            dirtyFields: [ 'prompt' ],
          }
        }
      }
    );
  });
});
