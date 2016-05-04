import React from 'react';
import CardDB from '../cards';
import CardOverviewScreen from './CardOverviewScreen.jsx';
import SettingsScreen from './SettingsScreen.jsx';
import Navbar from './Navbar.jsx';

export class App extends React.Component {
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

export default App;
