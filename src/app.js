import ReactDOM from 'react-dom';
import React from 'react';
import { browserHistory, Router, Route, Link } from 'react-router';
import { createStore } from 'redux';
import { connect, Provider } from 'react-redux';
import routeLocationDidUpdate from './actions/location.js';
import CardDB from './cards';
import CardOverviewScreen from './card-overview-screen.jsx';
import SettingsScreen from './settings-screen.jsx';
import Navbar from './navbar.jsx';

class App extends React.Component {
  static get propTypes() {
    return {
      screen: React.PropTypes.string,
    };
  }
  render() {
    return (
      <div>
        <Navbar />
        <main>
          <CardOverviewScreen db={CardDB} active={!this.props.screen} />
          <SettingsScreen active={this.props.screen === 'settings'} />
        </main>
      </div>
    );
  }
}

const mapStateToProps = (state) => {
  return {
    screen: state.screen
  }
}

const WiredApp = connect(mapStateToProps)(App);

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

// XXX Inline this below
function updateLocation() {
  store.dispatch(routeLocationDidUpdate(this.state));
}

ReactDOM.render(
  <Provider store={store}>
    <Router history={browserHistory} onUpdate={updateLocation}>
      <Route path="/(:screen)" component={WiredApp}/>
    </Router>
  </Provider>,
  document.getElementById('container')
);
