import { combineReducers } from 'redux';
import nav from './nav';
import settings from './settings';
import sync from './sync';

export default combineReducers({
  nav,
  settings,
  sync,
});
