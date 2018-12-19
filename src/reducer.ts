import { combineReducers } from 'redux';

import { Return } from './utils/type-helpers';
import { Action } from './actions';

import edit from './edit/reducer';
import review from './review/reducer';
import route from './route/reducer';
import { selection, SelectionState } from './selection/reducer';
import { sync } from './sync/reducer';

const componentReducers = {
  edit,
  review,
  route,
  sync,
};

// Beware... you're not going to like what follows.
//
// Basically we have this setup where we want the 'selection' to be based on the
// result of other reducers. It's awfully messy and ultimately we will just
// change the UI so we don't need that. Until then, however, we go through no
// end of hacks to make that work.

type ReducerResult<T> = { [P in keyof T]: Return<T[P]> };
type InnerState = ReducerResult<typeof componentReducers>;

const innerReducer = combineReducers<AppState, Action>({
  ...componentReducers,
  // We need to add a dummy reducer for selection here or else combine reducers
  // will complain:
  //
  //   Unexpected key "selection" found in previous state received by the
  //   reducer.
  //
  // Also we need to make sure to return some sort of default value or it will
  // complain about that too.
  selection: (state: SelectionState): SelectionState => state || 'yer',
});

// For determining the active card, we use the results other reducers (e.g. the
// review reducer will determine the current card which may become the active
// card).

const initialSelection: SelectionState = {
  activeCardId: undefined,
};

export type AppState = InnerState & { selection: SelectionState };

export function reducer(state: AppState | undefined, action: Action) {
  return selection(
    { selection: initialSelection, ...innerReducer(state, action) },
    action
  );
}

export default reducer;
