import React from 'react';
import { browserHistory } from 'react-router';
import { connect } from 'react-redux';

import CardOverviewScreen from './CardOverviewScreen.jsx';
import ControlOverlay from './ControlOverlay.jsx';
import Popup from './Popup.jsx';
import PopupOverlay from './PopupOverlay.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import SyncSettingsPanelContainer from './SyncSettingsPanelContainer.jsx';
import Navbar from './Navbar.jsx';

const ConnectedNavbar =
  connect(state => ({ syncState: state.sync.state }))(Navbar);

class App extends React.Component {
  static get propTypes() {
    return {
      nav: React.PropTypes.shape({
        screen: React.PropTypes.string,
        popup: React.PropTypes.string,
      }),
      route: React.PropTypes.object.isRequired,
    };
  }

  static get defaultProps() {
    return { nav: {} };
  }

  static get childContextTypes() {
    return { cardStore: React.PropTypes.object };
  }

  constructor(props) {
    super(props);
    this.closePopup = this.closePopup.bind(this);
  }

  getChildContext() {
    return { cardStore: this.props.route.cards };
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
        <ConnectedNavbar
          settingsActive={settingsActive}
          currentScreenLink={this.currentScreenLink} />
        <main>
          <PopupOverlay
            active={!!this.props.nav.popup}
            close={this.closePopup}>
            <CardOverviewScreen />
            <ControlOverlay>
              <button className="primary">Review</button>
              <button className="primary">Add</button>
            </ControlOverlay>
          </PopupOverlay>
          <Popup
            active={settingsActive}
            close={this.closePopup}>
            <SettingsPanel
              heading="Sync">
              <SyncSettingsPanelContainer />
            </SettingsPanel>
          </Popup>
        </main>
      </div>
    );
  }
}

const mapStateToProps = state => ({ nav: state.nav });
const ConnectedApp = connect(mapStateToProps)(App);

export default ConnectedApp;
