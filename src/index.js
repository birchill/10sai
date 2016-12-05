import ReactDOM from 'react-dom';
import React from 'react';
import { browserHistory, Router, Route } from 'react-router';
import { createStore, applyMiddleware } from 'redux';
import { Provider } from 'react-redux';
import createSagaMiddleware from 'redux-saga';
import createLogger from 'redux-logger';

import reducer from './reducers/index';
import syncSagas from './sagas/sync';
import SettingsStore from './SettingsStore';
import CardStore from './CardStore';
import App from './components/App.jsx';

import 'main.scss';

const sagaMiddleware = createSagaMiddleware();
const loggerMiddleware = createLogger();
const store = createStore(
  reducer,
  applyMiddleware(
    sagaMiddleware,
    loggerMiddleware
  )
);

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

ReactDOM.render(
  <Provider store={store}>
    <Router history={browserHistory}
      onUpdate={ function onUpdate() {
        store.dispatch({ type: 'CHANGE_LOCATION',
                         screen: this.state.params.screen });
      } }>
      <Route path="/(:screen)" component={App} cards={cardStore} />
    </Router>
  </Provider>,
  document.getElementById('container')
);
