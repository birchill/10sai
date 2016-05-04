import CardDB from './cards';
import CardOverviewScreen from './card-overview-screen.jsx';
import SettingsScreen from './settings-screen.jsx';
import Navbar from './navbar.jsx';

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
