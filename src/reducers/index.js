import { combineReducers } from 'redux';
import edit from './edit';
import route from './route';
import sync from './sync';

export default combineReducers({
  edit,
  route,
  sync,
});
