import ReactDOM from 'react-dom';
import React from 'react';
import { browserHistory, Router, Route, Link } from 'react-router';
import { createStore } from 'redux';
import { connect, Provider } from 'react-redux';
import routeLocationDidUpdate from './actions/location.js';
import App from './App.jsx';

const mapStateToProps = (state) => {
  return {
    screen: state.screen
  }
}

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
      onUpdate={
        function() { store.dispatch(routeLocationDidUpdate(this.state)) }
      }>
      <Route path="/(:screen)" component={ConnectedApp}/>
    </Router>
  </Provider>,
  document.getElementById('container')
);
