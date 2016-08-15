import ReactDOM from 'react-dom';
import React from 'react';
import { browserHistory, Router, Route } from 'react-router';
import { createStore, applyMiddleware } from 'redux';
import { Provider } from 'react-redux';
import thunkMiddleware from 'redux-thunk';
import createLogger from 'redux-logger';

import * as actions from './actions';
import reducer from './reducers/index';
import SettingsStore from './SettingsStore';
import CardStore from './CardStore';
import App from './components/App.jsx';

import 'main.scss';

const loggerMiddleware = createLogger();
const store = createStore(
  reducer,
  applyMiddleware(
    thunkMiddleware,
    loggerMiddleware
  )
);

//
// Cards store
//
const cards = new CardStore();

//
// Settings store
//
const settings = new SettingsStore();
const setSyncServer = syncServer => store.dispatch(
                        actions.setSyncServer(syncServer, settings, cards));
const updateSettingsFromStore = () => store.dispatch(
                                  actions.updateSettingsFromStore(settings));
settings.onUpdate(updateSettingsFromStore);

updateSettingsFromStore().then(() => {
  const syncServer = store.getState().settings.syncServer;
  if (syncServer) {
    setSyncServer(syncServer);
  }
});

ReactDOM.render(
  <Provider store={store}>
    <Router history={browserHistory}
      onUpdate={ function onUpdate() {
        store.dispatch(actions.updateLocation(this.state.params.screen));
      } }>
      <Route path="/(:screen)" component={App} cards={cards}
        settings={settings} />
    </Router>
  </Provider>,
  document.getElementById('container')
);
