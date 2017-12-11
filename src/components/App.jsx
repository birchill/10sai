import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import DocumentTitle from 'react-document-title';

import { URLFromRoute } from '../router';
import * as routeActions from '../actions/route';
import CardOverviewScreen from './CardOverviewScreen.jsx';
import EditCardScreen from './EditCardScreen.jsx';
import Link from './Link.jsx';
import Navbar from './Navbar.jsx';
import Popup from './Popup.jsx';
import PopupOverlay from './PopupOverlay.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import SyncSettingsPanelContainer from './SyncSettingsPanelContainer.jsx';
import TabBlock from './TabBlock.jsx';

const ConnectedNavbar =
  connect(state => ({ syncState: state.sync.state }))(Navbar);

class App extends React.Component {
  static get propTypes() {
    return {
      cards: PropTypes.object.isRequired,
      route: PropTypes.shape({
        screen: PropTypes.string,
        popup: PropTypes.string,
        search: PropTypes.object,
        hash: PropTypes.string,
        card: PropTypes.string,
      }),
      onClosePopup: PropTypes.func,
    };
  }

  static get defaultProps() {
    return { route: {} };
  }

  static get childContextTypes() {
    return { cardStore: PropTypes.object };
  }

  constructor(props) {
    super(props);
    this.closePopup = this.closePopup.bind(this);
  }

  getChildContext() {
    return { cardStore: this.props.cards };
  }

  get currentScreenLink() {
    const routeWithoutPopup = { ...this.props.route, popup: undefined };
    return URLFromRoute(routeWithoutPopup);
  }

  closePopup() {
    if (this.props.onClosePopup) {
      this.props.onClosePopup();
    }
  }

  render() {
    const settingsActive = this.props.route.popup === 'settings';

    let title = 'Tensai';
    if (this.props.route.popup) {
      const toTitle = str => str[0].toUpperCase() + str.substring(1);
      title += ` - ${toTitle(this.props.route.popup)}`;
    }

    let activeTab;
    if (this.props.route.screen === 'edit-card') {
      activeTab = 1;
    }

    return (
      <DocumentTitle title={title}>
        <div>
          <ConnectedNavbar
            settingsActive={settingsActive}
            currentScreenLink={this.currentScreenLink} />
          <main>
            <PopupOverlay
              active={!!this.props.route.popup}
              close={this.closePopup}>
              <CardOverviewScreen />
              <TabBlock active={activeTab} className="tabbar">
                <Link
                  id="lookup-tab"
                  href="/lookup"
                  aria-controls="lookup-page"
                  className="-icon -lookup">
                  Lookup
                </Link>
                <Link
                  id="edit-tab"
                  href="/cards/new"
                  aria-controls="edit-page"
                  className="-icon -plus">
                  Add
                </Link>
                <Link
                  id="review-tab"
                  href="/review"
                  aria-controls="review-page"
                  className="-icon -review">
                  Review
                </Link>
              </TabBlock>
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
          <EditCardScreen
            id="edit-page"
            role="tabpanel"
            aria-labelledby="edit-tab"
            aria-hidden={this.props.route.screen !== 'edit-card'}
            active={this.props.route.screen === 'edit-card'}
            card={this.props.route.card} />
        </div>
      </DocumentTitle>
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
    dispatch(routeActions.followLink(URLFromRoute(props.route), 'backwards'));
  }
});
const ConnectedApp = connect(mapStateToProps, mapDispatchToProps)(App);

export default ConnectedApp;
