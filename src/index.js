import ReactDOM from 'react-dom';
import React from 'react';
import { browserHistory, Router, Route } from 'react-router';
import { createStore } from 'redux';
import { connect, Provider } from 'react-redux';
import changeScreen from './actions/changeScreen.js';
import App from './App.jsx';

const mapStateToProps = state => ({ screen: state.screen });
const ConnectedApp = connect(mapStateToProps)(App);

const initialState = {};

function app(state = initialState, action) {
  switch (action.type) {
    case 'CHANGE_SCREEN':
      return { ...state, screen: action.screen };
    default:
      return state;
  }
}

let store = createStore(app);

ReactDOM.render(
  <Provider store={store}>
    <Router history={browserHistory}
      onUpdate={ function onUpdate() {
        store.dispatch(changeScreen(this.state.params.screen));
      } }>
      <Route path="/(:screen)" component={ConnectedApp} />
    </Router>
  </Provider>,
  document.getElementById('container')
);
