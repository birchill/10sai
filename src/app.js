import ReactDOM from 'react-dom';
import React from 'react';
import { browserHistory, Router, Route, IndexRoute, Link } from 'react-router';
import ReactCSSTransitionGroup from 'react-addons-css-transition-group';
import _ from 'lodash';
import CardDB from './cards';
import CardOverviewScreen from './card-overview-screen.jsx';
import SettingsScreen from './settings-screen.jsx';
import Navbar from './navbar.jsx';

class App extends React.Component {
  render() {
    return (
      <div>
        <Navbar />
        <ReactCSSTransitionGroup
          component="main"
          transitionName="screen"
          transitionEnterTimeout={300}
          transitionLeaveTimeout={300}>
          { React.cloneElement(this.props.children,
                              { key: this.props.location.pathname }) }
        </ReactCSSTransitionGroup>
      </div>
    );
  }
}

function createElement(Component, props) {
  if (Component === CardOverviewScreen) {
    _.extend(props, { db: CardDB });
  }
  return <Component {...props} />;
}

ReactDOM.render((
  <Router history={browserHistory} createElement={createElement}>
    <Route path="/" component={App}>
      <IndexRoute component={CardOverviewScreen} />
      <Route path="settings" component={SettingsScreen} />
    </Route>
  </Router>
), document.getElementById('container'));
