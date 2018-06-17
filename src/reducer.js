import { combineReducers } from 'redux';
import edit from './edit/reducer.ts';
import review from './review/reducer.ts';
import route from './route/reducer';
import selection from './selection/reducer';
import sync from './sync/reducer';

const combinedReducer = combineReducers({
  edit,
  review,
  route,
  sync,
  selection: state => state || 'Chillax combineReducers, this is fine',
});

// For determining the active card, we use the results other reducers (e.g. the
// review reducer will determine the current card which may become the active
// card).

const initialGlobalState = {
  selection: {
    activeCardId: undefined,
  },
};

export default function rootReducer(state = initialGlobalState, action) {
  return selection(combinedReducer(state, action), action);
}
