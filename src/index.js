import ReactDOM from 'react-dom';
import React from 'react';
import { createStore, applyMiddleware } from 'redux';
import { Provider } from 'react-redux';
import createSagaMiddleware from 'redux-saga';

import reducer from './reducers/index';
import syncSagas from './sagas/sync';
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
  const createLogger = require('redux-logger');
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
  yield [ syncSagas(cardStore, settingsStore, store.dispatch.bind(store)) ];
});

//
// Router
//

store.dispatch({ type: 'NAVIGATE', url: window.location.pathname });
window.addEventListener('popstate', () => {
  store.dispatch({ type: 'NAVIGATE', url: window.location.pathname });
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
