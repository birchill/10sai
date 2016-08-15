import React from 'react';
import { browserHistory } from 'react-router';
import { connect } from 'react-redux';

import { setSyncServer } from '../actions';

import CardOverviewScreen from './CardOverviewScreen.jsx';
import Popup from './Popup.jsx';
import PopupOverlay from './PopupOverlay.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import LocalSyncSettingsPanel from './LocalSyncSettingsPanel.jsx';
import Navbar from './Navbar.jsx';

class App extends React.Component {
  static get propTypes() {
    return {
      nav: React.PropTypes.shape({
        screen: React.PropTypes.string,
        popup: React.PropTypes.string,
      }),
      route: React.PropTypes.object.isRequired,
      onSetSyncServer: React.PropTypes.func.isRequired,
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
            <CardOverviewScreen db={this.props.route.cards} />
          </PopupOverlay>
          <Popup active={settingsActive} close={this.closePopup}>
            <SettingsPanel heading="Sync">
              <LocalSyncSettingsPanel
                onSubmit={this.props.onSetSyncServer}
                onPause={function stub() {}} />
            </SettingsPanel>
          </Popup>
        </main>
      </div>
    );
  }
}

const mapStateToProps = state => ({ nav: state.nav });
const mapDispatchToProps = (dispatch, ownProps) => (
  {
    onSetSyncServer: syncServer => {
      dispatch(setSyncServer(syncServer,
                             ownProps.route.settings,
                             ownProps.route.cards));
    },
  });
const ConnectedApp = connect(mapStateToProps, mapDispatchToProps)(App);

export default ConnectedApp;
