import React from 'react';
import CardDB from '../cards';
import CardOverviewScreen from './CardOverviewScreen.jsx';
import SettingsPopup from './SettingsPopup.jsx';
import ActiveNavbar from './ActiveNavbar.jsx';

export class App extends React.Component {
  static get propTypes() {
    return {
      nav: React.PropTypes.shape({
        screen: React.PropTypes.string,
        popup: React.PropTypes.string,
      }),
    };
  }

  render() {
    const popupClasses = [ 'popup-overlay' ];
    if (this.props.nav.popup) {
      popupClasses.push('active');
    }

    return (
      <div>
        <ActiveNavbar />
        <main>
          <CardOverviewScreen db={CardDB} />
          <div className={ popupClasses.join(' ') } />
          <SettingsPopup active={this.props.nav.popup === 'settings'} />
        </main>
      </div>
    );
  }
}

export default App;
