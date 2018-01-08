import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import DocumentTitle from 'react-document-title';

import { URLFromRoute } from '../router';
import { getReviewProgress } from '../selectors/review';
import CardList from '../CardList';
import ReviewSyncListener from '../ReviewSyncListener';

import EditCardScreen from './EditCardScreen.jsx';
import HomeScreenContainer from './HomeScreenContainer.jsx';
import Link from './Link.jsx';
import LookupScreen from './LookupScreen.jsx';
import Popup from './Popup.jsx';
import ReviewScreenContainer from './ReviewScreenContainer.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import SyncSettingsPanelContainer from './SyncSettingsPanelContainer.jsx';
import TabBlock from './TabBlock.jsx';
import TabPanel from './TabPanel.jsx';

class App extends React.Component {
  static get propTypes() {
    return {
      // eslint-disable-next-line react/forbid-prop-types
      cardStore: PropTypes.object.isRequired,
      route: PropTypes.shape({
        screen: PropTypes.string,
        popup: PropTypes.string,
        // eslint-disable-next-line react/forbid-prop-types
        search: PropTypes.object,
        hash: PropTypes.string,
        card: PropTypes.string,
      }),
      activeCardId: PropTypes.string,
      reviewProgress: PropTypes.shape({
        failedCardsLevel1: PropTypes.number.isRequired,
        failedCardsLevel2: PropTypes.number.isRequired,
        completedCards: PropTypes.number.isRequired,
        unreviewedCards: PropTypes.number.isRequired,
      }),
      onClosePopup: PropTypes.func,
    };
  }

  static get defaultProps() {
    return { route: {} };
  }

  static get childContextTypes() {
    return { cardList: PropTypes.object };
  }

  constructor(props) {
    super(props);
    this.closePopup = this.closePopup.bind(this);
    this.cardList = new CardList(props.cardStore);
    this.reviewSyncListener = new ReviewSyncListener(props.cardStore);
  }

  getChildContext() {
    return { cardList: this.cardList };
  }

  get currentScreenLink() {
    const routeWithoutPopup = {
      ...this.props.route,
      popup: undefined,
      // Generally the fragment is targetting something in the popup so we
      // should drop that too. Not sure what to do if we ever find that we need
      // a fragment on a page and then a popup on top of that.
      fragment: undefined,
    };
    return URLFromRoute(routeWithoutPopup);
  }

  closePopup() {
    if (this.props.onClosePopup) {
      this.props.onClosePopup();
    }
  }

  render() {
    let title = '10sai';
    if (this.props.route.popup) {
      const toTitle = str => str[0].toUpperCase() + str.substring(1);
      title += ` - ${toTitle(this.props.route.popup)}`;
    }

    const screens = ['lookup', 'edit-card', 'review'];
    let activeTab = screens.indexOf(this.props.route.screen);
    if (activeTab === -1) {
      activeTab = undefined;
    }
    const tabPanelClass = typeof activeTab === 'undefined' ? '-allhidden' : '';

    // Edit/Add handling
    const [addEditLink, addEditLabel, addEditClass] = this.props.activeCardId
      ? [`/cards/${this.props.activeCardId}`, 'Edit', '-edit-card']
      : ['/cards/new', 'Add', '-add-card'];

    // Review handling
    let remainingReviews;
    if (this.props.reviewProgress) {
      const {
        failedCardsLevel1,
        failedCardsLevel2,
        unreviewedCards,
      } = this.props.reviewProgress;
      remainingReviews =
        failedCardsLevel1 + failedCardsLevel2 * 2 + unreviewedCards;
    }

    return (
      <DocumentTitle title={title}>
        {/*
          * This wrapper div is simply because DocumentTitle only expects to
          * have a single child. See:
          *
          *   https://github.com/gaearon/react-document-title/issues/48
          */}
        <div className="app">
          <div className="screens">
            <HomeScreenContainer />
            <TabPanel
              id="lookup-page"
              role="tabpanel"
              aria-labelledby="lookup-tab"
              className={tabPanelClass}
              hidden={this.props.route.screen !== 'lookup'}>
              <LookupScreen active={this.props.route.screen === 'lookup'} />
            </TabPanel>
            <TabPanel
              id="edit-page"
              role="tabpanel"
              aria-labelledby="edit-tab"
              className={tabPanelClass}
              hidden={this.props.route.screen !== 'edit-card'}>
              <EditCardScreen
                active={this.props.route.screen === 'edit-card'}
                card={this.props.route.card}
              />
            </TabPanel>
            <TabPanel
              id="review-page"
              role="tabpanel"
              aria-labelledby="review-tab"
              className={tabPanelClass}
              hidden={this.props.route.screen !== 'review'}>
              <ReviewScreenContainer
                syncListener={this.reviewSyncListener}
                active={this.props.route.screen === 'review'}
              />
            </TabPanel>
          </div>
          <TabBlock active={activeTab} className="tabbar -white">
            <Link
              id="lookup-tab"
              href="/lookup"
              aria-controls="lookup-page"
              className="-icon -lookup">
              Lookup
            </Link>
            <Link
              id="edit-tab"
              href={addEditLink}
              aria-controls="edit-page"
              className={`-icon ${addEditClass}`}>
              {addEditLabel}
            </Link>
            <Link
              id="review-tab"
              href="/review"
              aria-controls="review-page"
              className={`-icon -review ${remainingReviews ? '-badge' : ''}`}
              data-badge={remainingReviews}>
              Review
            </Link>
          </TabBlock>
          <Popup
            active={this.props.route.popup === 'settings'}
            currentScreenLink={this.currentScreenLink}>
            <SettingsPanel heading="Sync">
              <SyncSettingsPanelContainer />
            </SettingsPanel>
          </Popup>
        </div>
      </DocumentTitle>
    );
  }
}

const mapStateToProps = state => ({
  route:
    state.route && state.route.history && state.route.history.length
      ? state.route.history[state.route.index]
      : {},
  activeCardId: state.selection.activeCardId,
  reviewProgress: getReviewProgress(state),
});

const ConnectedApp = connect(mapStateToProps)(App);

export default ConnectedApp;
