import ReactDOM from 'react-dom';
import React from 'react';
import { createStore, applyMiddleware } from 'redux';
import { Provider } from 'react-redux';
import createSagaMiddleware from 'redux-saga';
import { all } from 'redux-saga/effects';

import reducer from './reducers/index';

import editSagas from './sagas/edit';
import syncSagas from './sagas/sync';
import routeSagas from './sagas/route';

import * as routeActions from './actions/route';

import SettingsStore from './SettingsStore';
import CardStore from './CardStore';
import App from './components/App.jsx';

import 'main.scss'; // eslint-disable-line

//
// Redux store
//

const sagaMiddleware = createSagaMiddleware();

let store;
if (process.env.NODE_ENV === 'development') {
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  const createLogger = require('redux-logger').createLogger;
  const loggerMiddleware = createLogger();
  store = createStore(
    reducer,
    applyMiddleware(sagaMiddleware, loggerMiddleware)
  );
} else {
  store = createStore(reducer, applyMiddleware(sagaMiddleware));
}

//
// Local data stores
//

const cardStore = new CardStore();

cardStore.changes.on('change', change => {
  const cardBeingEdited = store.getState().edit.forms.active.card;
  if (cardBeingEdited &&
      cardBeingEdited._id === change.id) {
    store.dispatch({ type: 'SYNC_CARD', card: change.doc });
  }
});

const settingsStore = new SettingsStore();

const dispatchSettingUpdates = settings => {
  for (const key in settings) {
    if (settings.hasOwnProperty(key)) {
      store.dispatch({ type: 'UPDATE_SETTING', key, value: settings[key] });
    }
  }
};

settingsStore.getSettings().then(dispatchSettingUpdates);
settingsStore.onUpdate(dispatchSettingUpdates);

//
// Sagas
//

sagaMiddleware.run(function* allSagas() {
  yield all([
    editSagas(cardStore),
    syncSagas(cardStore, settingsStore, store.dispatch.bind(store)),
    routeSagas(),
  ]);
});

//
// Router
//

store.dispatch(routeActions.navigate({
                 path: window.location.pathname,
                 search: window.location.search,
                 fragment: window.location.hash }));
window.addEventListener('popstate', evt => {
  // Dispatch before change and navigate actions in parallel. The URL
  // has already been updated so there's no going back and no need to
  // wait to see if any before change screen actions succeed.
  store.dispatch(routeActions.beforeChangeScreen());
  store.dispatch(routeActions.navigate(
    { path: window.location.pathname,
      search: window.location.search,
      fragment: window.location.hash,
      index: evt.state ? evt.state.index : 0,
      source: 'history' }
  ));
});

//
// Offline notification
//

window.addEventListener('online',
                        () => { store.dispatch({ type: 'GO_ONLINE' }); });
window.addEventListener('offline',
                        () => { store.dispatch({ type: 'GO_OFFLINE' }); });

//
// Render the root component
//

ReactDOM.render(
  <Provider store={store}>
    <App cards={cardStore} />
  </Provider>,
  document.getElementById('container')
);
