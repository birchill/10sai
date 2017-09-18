import { combineReducers } from 'redux';
import edit from './edit';
import review from './review';
import route from './route';
import sync from './sync';

export default combineReducers({
  edit,
  review,
  route,
  sync,
});
