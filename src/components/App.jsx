import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import DocumentTitle from 'react-document-title';

import { URLFromRoute } from '../route/router';
import * as routeActions from '../route/actions';
import { getReviewProgress } from '../review/selectors.ts';
import CardList from '../CardList.ts';
import KeywordSuggester from '../suggestions/KeywordSuggester.ts';
import TagSuggester from '../suggestions/TagSuggester.ts';
import { hasCommandModifier, isTextBox } from '../utils/keyboard.ts';

import EditCardScreen from './EditCardScreen.tsx';
import HomeScreenContainer from './HomeScreenContainer.tsx';
import DataStoreContext from './DataStoreContext.ts';
import KeywordSuggesterContext from './KeywordSuggesterContext.ts';
import { LookupScreen } from './LookupScreen.tsx';
import MainTabBlock from './MainTabBlock.tsx';
import { Popup } from './Popup.tsx';
import { ReviewScreenContainer } from './ReviewScreenContainer.tsx';
import { SettingsPanel } from './SettingsPanel.tsx';
import SyncSettingsPanelContainer from './SyncSettingsPanelContainer.tsx';
import { TabPanel } from './TabPanel.tsx';
import TagSuggesterContext from './TagSuggesterContext.ts';

class App extends React.PureComponent {
  static get propTypes() {
    return {
      // eslint-disable-next-line react/forbid-prop-types
      dataStore: PropTypes.object.isRequired,
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
      onNewCard: PropTypes.func,
      onGoHome: PropTypes.func,
      onGoReview: PropTypes.func,
      onGoLookup: PropTypes.func,
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
    this.cardList = new CardList(props.dataStore);
    this.keywordSuggester = new KeywordSuggester(props.dataStore);
    this.tagSuggester = new TagSuggester(props.dataStore);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  componentDidMount() {
    document.documentElement.addEventListener('keydown', this.handleKeyDown);
  }

  componentWillUnmount() {
    document.documentElement.removeEventListener('keydown', this.handleKeyDown);
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

  handleKeyDown(e) {
    // App-wide keyboard shortcuts
    if (e.defaultPrevented) {
      return;
    }

    // There are two kinds of global shortcuts:
    //
    // a) Single keys pressed when the focus is not in some sort of text area,
    //    e.g. 'c' to create a new card.
    //
    // b) Ctrl+Shift+<letter> for the equivalent shortcut that can be used even
    //    when some sort of text area is in focus.
    //
    // The reason we use Ctrl+Shift+<letter> is that:
    //
    // - Ctrl+<letter> is typically already assigned something for formatting
    //   etc.
    // - Alt+<letter> often triggers menus and is not overridable in some
    //   browsers
    // - Ctrl+Alt+<letter> maps to AltGr+<letter> on some Windows systems and
    //   might therefore be used by someone simply trying to use AltGr.
    //   Similarly, AltGr is often reported as having both Ctrl and Alt active.

    // Check it is a global shortcut
    if (
      (isTextBox(e.target) ||
        e.altKey ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey) &&
      (!hasCommandModifier(e) || !e.shiftKey)
    ) {
      return;
    }

    // c = New card. This matches Gmail (compose message) and Github (new issue)
    if (e.key.toLowerCase() === 'c') {
      this.props.onNewCard();
      e.preventDefault();
      // h = home screen
    } else if (e.key.toLowerCase() === 'h') {
      this.props.onGoHome();
      e.preventDefault();
      // r = review screen
    } else if (e.key.toLowerCase() === 'r') {
      this.props.onGoReview();
      e.preventDefault();
      // l = lookup screen
    } else if (e.key.toLowerCase() === 'l') {
      this.props.onGoLookup();
      e.preventDefault();
    }
  }

  render() {
    let title = '10sai';
    if (this.props.route.popup) {
      const toTitle = str => str[0].toUpperCase() + str.substring(1);
      title += ` - ${toTitle(this.props.route.popup)}`;
    }

    const tabSelected = ['lookup', 'edit-card', 'review'].includes(
      this.props.route.screen
    );
    const tabPanelClass = tabSelected ? '' : '-allhidden';

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
        <DataStoreContext.Provider value={this.props.dataStore}>
          <TagSuggesterContext.Provider value={this.tagSuggester}>
            <KeywordSuggesterContext.Provider value={this.keywordSuggester}>
              <div className="app">
                <div className="screens">
                  <HomeScreenContainer />
                  <TabPanel
                    id="lookup-page"
                    role="tabpanel"
                    aria-labelledby="lookup-tab"
                    className={tabPanelClass}
                    hidden={this.props.route.screen !== 'lookup'}
                  >
                    <LookupScreen
                      active={this.props.route.screen === 'lookup'}
                    />
                  </TabPanel>
                  <TabPanel
                    id="edit-page"
                    role="tabpanel"
                    aria-labelledby="edit-tab"
                    className={tabPanelClass}
                    hidden={this.props.route.screen !== 'edit-card'}
                  >
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
                    hidden={this.props.route.screen !== 'review'}
                  >
                    <ReviewScreenContainer
                      active={this.props.route.screen === 'review'}
                    />
                  </TabPanel>
                </div>
                <MainTabBlock
                  className="-white"
                  activeTab={this.props.route.screen}
                  activeCardId={this.props.activeCardId}
                  remainingReviews={remainingReviews}
                />
                <Popup
                  active={this.props.route.popup === 'settings'}
                  currentScreenLink={this.currentScreenLink}
                >
                  <SettingsPanel heading="Sync">
                    <SyncSettingsPanelContainer />
                  </SettingsPanel>
                </Popup>
              </div>
            </KeywordSuggesterContext.Provider>
          </TagSuggesterContext.Provider>
        </DataStoreContext.Provider>
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
const mapDispatchToProps = (dispatch, props) => ({
  onNewCard: () => {
    dispatch(routeActions.followLink('/cards/new', 'forwards', true));
  },
  onGoHome: () => {
    dispatch(routeActions.followLink('/', 'forwards', false));
  },
  onGoReview: () => {
    dispatch(routeActions.followLink('/review', 'forwards', false));
  },
  onGoLookup: () => {
    dispatch(routeActions.followLink('/lookup', 'forwards', false));
  },
});

const ConnectedApp = connect(
  mapStateToProps,
  mapDispatchToProps
)(App);

export default ConnectedApp;
