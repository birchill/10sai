import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { createStore, applyMiddleware, compose, Store } from 'redux';
import { Provider } from 'react-redux';
import createSagaMiddleware from 'redux-saga';
import { all } from 'redux-saga/effects';

import { Action } from './actions';
import { reducer, AppState } from './reducer';

import { editSagas, syncEditChanges } from './edit/sagas';
import { noteSagas } from './notes/sagas';
import { reviewSagas } from './review/sagas';
import { routeSagas } from './route/sagas';
import { syncSagas } from './sync/sagas';

import { sync as reviewSync } from './review/sync';

import * as routeActions from './route/actions';

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

let store: Store<AppState, Action>;

if (process.env.NODE_ENV === 'development') {
  const { createLogger } = require('redux-logger');
  const loggerMiddleware = createLogger();
  const composeEnhancers: <F extends Function>(f: F) => F =
    window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
  store = createStore<AppState, Action, {}, {}>(
    reducer,
    composeEnhancers(applyMiddleware(sagaMiddleware, loggerMiddleware))
  );
} else {
  store = createStore<AppState, Action, {}, {}>(
    reducer,
    applyMiddleware(sagaMiddleware)
  );
}

//
// Local data stores
//

const getReviewTime = (): Date => {
  const reviewTime = new Date();
  reviewTime.setMinutes(0);
  reviewTime.setSeconds(0);
  reviewTime.setMilliseconds(0);
  return reviewTime;
};

const dataStore = new DataStore({ reviewTime: getReviewTime() });

syncEditChanges(dataStore, store);
reviewSync(dataStore, store);

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
    reviewSagas(dataStore),
    syncSagas(dataStore, store.dispatch.bind(store)),
    routeSagas(),
  ]);
});

//
// Router
//

store.dispatch(
  routeActions.navigate({
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
  store.dispatch(routeActions.beforeScreenChange());
  store.dispatch(
    routeActions.navigate({
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
// Review time rotation
//
// We round the review time to the previous hour and then update it every hour.
// So, for example, if we open the app at 08:49, we'll set the review time to
// 08:00. Then, at 09:49 (NOT 09:00) we'll set the review time to
// 09:00.
//
// That means that if we review at roughly the same time every day any cards
// which are marked as due precisely one day later will show up and it will also
// prevent splitting cards reviewed at roughly the same time across different
// review times.
(() => {
  const MS_PER_HOUR = 60 * 60 * 1000;
  setInterval(() => {
    store.dispatch({ type: 'SET_REVIEW_TIME', reviewTime: getReviewTime() });
  }, 1 * MS_PER_HOUR);
})();

//
// Render the root component
//

ReactDOM.render(
  <Provider store={store}>
    <App dataStore={dataStore} />
  </Provider>,
  document.getElementById('container')
);
