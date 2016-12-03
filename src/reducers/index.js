import { combineReducers } from 'redux';
import nav from './nav';
import sync from './sync';

export default combineReducers({
  nav,
  sync,
});
