import ReactDOM from 'react-dom';
import React from 'react';
import { browserHistory, Router, Route } from 'react-router';
import { createStore, combineReducers } from 'redux';
import { connect, Provider } from 'react-redux';
import { changeScreen } from './actions';
import screen from './reducers/screen';
import App from './App.jsx';

const mapStateToProps = state => ({ screen: state.screen });
const ConnectedApp = connect(mapStateToProps)(App);

const app = combineReducers({ screen });
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
