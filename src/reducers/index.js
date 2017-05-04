import { combineReducers } from 'redux';
import route from './route';
import sync from './sync';

export default combineReducers({
  route,
  sync,
});
