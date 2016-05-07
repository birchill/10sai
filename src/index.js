import ReactDOM from 'react-dom';
import React from 'react';
import { browserHistory, Router, Route } from 'react-router';
import { createStore } from 'redux';
import { connect, Provider } from 'react-redux';

import { updateLocation } from './actions';
import reducer from './reducers/index';
import App from './components/App.jsx';

const mapStateToProps = state => ({ nav: state.nav });
const ConnectedApp = connect(mapStateToProps)(App);

const store = createStore(reducer);

ReactDOM.render(
  <Provider store={store}>
    <Router history={browserHistory}
      onUpdate={ function onUpdate() {
        store.dispatch(updateLocation(this.state.params.screen));
      } }>
      <Route path="/(:screen)" component={ConnectedApp} />
    </Router>
  </Provider>,
  document.getElementById('container')
);
