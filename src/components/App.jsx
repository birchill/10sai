import React from 'react';
import { connect } from 'react-redux';

import { URLFromRoute } from '../router';
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
        search: React.PropTypes.object,
        hash: React.PropTypes.string,
      }),
      onClosePopup: React.PropTypes.func,
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
    return URLFromRoute(this.props.route);
  }

  closePopup() {
    if (this.props.onClosePopup) {
      this.props.onClosePopup();
    }
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

const mapStateToProps = state => ({
  route: state.route &&
         state.route.history &&
         state.route.history.length
         ? state.route.history[state.route.index]
         : {}
});
const mapDispatchToProps = (dispatch, props) => ({
  onClosePopup: () => {
    dispatch({ type: 'FOLLOW_LINK',
               url: URLFromRoute(props.route),
               direction: 'backwards' });
  }
});
const ConnectedApp = connect(mapStateToProps, mapDispatchToProps)(App);

export default ConnectedApp;
