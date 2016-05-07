import React from 'react';
import { browserHistory } from 'react-router';

import CardDB from '../cards';
import CardOverviewScreen from './CardOverviewScreen.jsx';
import Popup from './Popup.jsx';
import PopupOverlay from './PopupOverlay.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import Navbar from './Navbar.jsx';

export class App extends React.Component {
  static get propTypes() {
    return {
      nav: React.PropTypes.shape({
        screen: React.PropTypes.string,
        popup: React.PropTypes.string,
      }),
    };
  }

  constructor(props) {
    super(props);
    this.closePopup = this.closePopup.bind(this);
  }

  get currentScreenLink() {
    return `/${this.props.nav.screen || ''}`;
  }

  closePopup() {
    browserHistory.replace(this.currentScreenLink);
  }

  render() {
    const settingsActive = this.props.nav.popup === 'settings';

    return (
      <div>
        <Navbar settingsActive={settingsActive}
          currentScreenLink={this.currentScreenLink} />
        <main>
          <PopupOverlay active={!!this.props.nav.popup} close={this.closePopup}>
            <CardOverviewScreen db={CardDB} />
          </PopupOverlay>
          <Popup active={settingsActive} close={this.closePopup}>
            <SettingsPanel />
          </Popup>
        </main>
      </div>
    );
  }
}

export default App;
