import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { createStore, applyMiddleware, compose, Store } from 'redux';
import { Provider } from 'react-redux';
import createSagaMiddleware from 'redux-saga';
import { all } from 'redux-saga/effects';

import * as Actions from './actions';
import { reducer, AppState } from './reducer';

import { editSagas, syncEditChanges } from './edit/sagas';
import { noteSagas } from './notes/sagas';
import { reviewSagas } from './review/sagas';
import { routeSagas } from './route/sagas';
import { syncSagas } from './sync/sagas';

import { sync as reviewSync } from './review/sync';
import { AvailableCardWatcher } from './review/available-card-watcher';

import { DataStore } from './store/DataStore';
import { SettingChange, Settings } from './store/SettingsStore';
import { App } from './components/App';

import 'main.scss';

declare global {
  interface Window {
    __REDUX_DEVTOOLS_EXTENSION_COMPOSE__?: <F extends Function>(f: F) => F;
  }
}

//
// Redux store
//

const sagaMiddleware = createSagaMiddleware();

let store: Store<AppState, Actions.Action>;

if (process.env.NODE_ENV === 'development') {
  const { createLogger } = require('redux-logger');
  const loggerMiddleware = createLogger();
  const composeEnhancers: <F extends Function>(f: F) => F =
    window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
  store = createStore<AppState, Actions.Action, {}, {}>(
    reducer,
    composeEnhancers(applyMiddleware(sagaMiddleware, loggerMiddleware))
  );
} else {
  store = createStore<AppState, Actions.Action, {}, {}>(
    reducer,
    applyMiddleware(sagaMiddleware)
  );
}

//
// Local data stores
//

const dataStore = new DataStore();
const availableCardWatcher = new AvailableCardWatcher({ dataStore });

syncEditChanges(dataStore, store);
reviewSync({ dataStore, store, availableCardWatcher });

const dispatchSettingUpdates = (settings: Settings) => {
  for (const key in settings) {
    if (settings.hasOwnProperty(key)) {
      store.dispatch({
        type: 'UPDATE_SETTING',
        key,
        value: settings[key],
      });
    }
  }
};

dataStore.getSettings().then(dispatchSettingUpdates);
dataStore.changes.on('setting', (change: SettingChange) => {
  dispatchSettingUpdates(change.setting);
});

//
// Sagas
//

sagaMiddleware.run(function* allSagas() {
  yield all([
    editSagas(dataStore),
    noteSagas(dataStore),
    reviewSagas({ dataStore, availableCardWatcher }),
    syncSagas(dataStore, store.dispatch.bind(store)),
    routeSagas(),
  ]);
});

//
// Router
//

store.dispatch(
  Actions.navigate({
    path: window.location.pathname,
    search: window.location.search,
    fragment: window.location.hash,
  })
);
window.addEventListener('popstate', evt => {
  // Dispatch before change and navigate actions in parallel. The URL
  // has already been updated so there's no going back and no need to
  // wait to see if any before change screen actions succeed.
  //
  // This requires that the beforeScreenChange fetches anything it needs from
  // the current state in a synchronous state (as the navigate action might
  // cause parts of the current state to be clobbered).
  store.dispatch(Actions.beforeScreenChange());
  store.dispatch(
    Actions.navigate({
      path: window.location.pathname,
      search: window.location.search,
      fragment: window.location.hash,
      source: {
        type: 'history',
        index: evt.state ? evt.state.index : 0,
      },
    })
  );
});

//
// Offline notification
//

window.addEventListener('online', () => {
  store.dispatch({ type: 'GO_ONLINE' });
});
window.addEventListener('offline', () => {
  store.dispatch({ type: 'GO_OFFLINE' });
});

//
// Render the root component
//

ReactDOM.render(
  <Provider store={store}>
    <App dataStore={dataStore} />
  </Provider>,
  document.getElementById('container')
);
