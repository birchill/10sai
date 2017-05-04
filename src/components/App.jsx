import React from 'react';
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
      cards: React.PropTypes.object.isRequired,
      route: React.PropTypes.shape({
        screen: React.PropTypes.string,
        popup: React.PropTypes.string,
      }),
    };
  }

  static get defaultProps() {
    return { route: {} };
  }

  static get childContextTypes() {
    return { cardStore: React.PropTypes.object };
  }

  constructor(props) {
    super(props);
    this.closePopup = this.closePopup.bind(this);
  }

  getChildContext() {
    return { cardStore: this.props.cards };
  }

  get currentScreenLink() {
    return `/${this.props.route.screen || ''}`;
  }

  closePopup() {
    history.replaceState({}, null, this.currentScreenLink);
  }

  render() {
    const settingsActive = this.props.route.popup === 'settings';

    return (
      <div>
        <ConnectedNavbar
          settingsActive={settingsActive}
          currentScreenLink={this.currentScreenLink} />
        <main>
          <PopupOverlay
            active={!!this.props.route.popup}
            close={this.closePopup}>
            <CardOverviewScreen />
            <ControlOverlay>
              <button className="-primary -large -shadow -icon -review">
                Review
              </button>
              <button className="-primary -large -shadow -icon -add-lookup">
                Add
              </button>
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

const mapStateToProps = state => ({ route: state.route });
const ConnectedApp = connect(mapStateToProps)(App);

export default ConnectedApp;
