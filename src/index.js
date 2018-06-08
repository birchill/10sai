import ReactDOM from 'react-dom';
import React from 'react';
import { createStore, applyMiddleware, compose } from 'redux';
import { Provider } from 'react-redux';
import createSagaMiddleware from 'redux-saga';
import { all } from 'redux-saga/effects';

import reducer from './reducer';

import { editSagas, syncEditChanges } from './edit/sagas.ts';
import reviewSagas from './review/sagas';
import routeSagas from './route/sagas';
import syncSagas from './sync/sagas';

import reviewSync from './review/sync';

import * as routeActions from './route/actions';

import SettingsStore from './SettingsStore';
import DataStore from './store/DataStore.ts';
import DataStoreContext from './components/DataStoreContext.ts';
import App from './components/App.jsx';

import 'main.scss'; // eslint-disable-line

//
// Redux store
//

const sagaMiddleware = createSagaMiddleware();

let store;
if (process.env.NODE_ENV === 'development') {
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  const { createLogger } = require('redux-logger');
  const loggerMiddleware = createLogger();
  const composeEnhancers =
    window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
  store = createStore(
    reducer,
    composeEnhancers(applyMiddleware(sagaMiddleware, loggerMiddleware))
  );
} else {
  store = createStore(reducer, applyMiddleware(sagaMiddleware));
}

//
// Local data stores
//

const getReviewTime = () => {
  const reviewTime = new Date();
  reviewTime.setMinutes(0);
  reviewTime.setSeconds(0);
  reviewTime.setMilliseconds(0);
  return reviewTime;
};

const dataStore = new DataStore({ reviewTime: getReviewTime() });

syncEditChanges(dataStore, store);
reviewSync(dataStore, store);

const settingsStore = new SettingsStore();

const dispatchSettingUpdates = settings => {
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

settingsStore.getSettings().then(dispatchSettingUpdates);
settingsStore.onUpdate(dispatchSettingUpdates);

//
// Sagas
//

sagaMiddleware.run(function* allSagas() {
  yield all([
    editSagas(dataStore),
    reviewSagas(dataStore),
    syncSagas(dataStore, settingsStore, store.dispatch.bind(store)),
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
      index: evt.state ? evt.state.index : 0,
      source: 'history',
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
    <DataStoreContext.Provider value={dataStore}>
      <App dataStore={dataStore} />
    </DataStoreContext.Provider>
  </Provider>,
  document.getElementById('container')
);
