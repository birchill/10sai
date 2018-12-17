import * as React from 'react';
import { connect } from 'react-redux';
import { Dispatch } from 'redux';
import DocumentTitle from 'react-document-title';

import { AppState } from '../reducer';
import { Action } from '../actions';
import { DataStore } from '../store/DataStore';
import { URLFromRoute, Route } from '../route/router';
import * as routeActions from '../route/actions';
import { getReviewProgress } from '../review/selectors';
import { CardList } from '../CardList';
import { KeywordSuggester } from '../suggestions/KeywordSuggester';
import { TagSuggester } from '../suggestions/TagSuggester';
import { hasCommandModifier, isTextBox } from '../utils/keyboard';
import { Return } from '../utils/type-helpers';

import { EditCardScreen } from './EditCardScreen';
import { HomeScreenContainer } from './HomeScreenContainer';
import { CardListContext } from './CardListContext';
import { DataStoreContext } from './DataStoreContext';
import { KeywordSuggesterContext } from './KeywordSuggesterContext';
import { LookupScreen } from './LookupScreen';
import { MainTabBlock, TabName } from './MainTabBlock';
import { Popup } from './Popup';
import { ReviewScreenContainer } from './ReviewScreenContainer';
import { SettingsPanel } from './SettingsPanel';
import { SyncSettingsPanelContainer } from './SyncSettingsPanelContainer';
import { TabPanel } from './TabPanel';
import { TagSuggesterContext } from './TagSuggesterContext';

interface Props {
  dataStore: DataStore;
  route: Route;
  activeCardId?: string;
  reviewProgress: {
    failedCardsLevel1: number;
    failedCardsLevel2: number;
    completedCards: number;
    unreviewedCards: number;
  };
  onNewCard: () => void;
  onGoHome: () => void;
  onGoReview: () => void;
  onGoLookup: () => void;
}

class AppInner extends React.PureComponent<Props> {
  cardList: CardList;
  keywordSuggester: KeywordSuggester;
  tagSuggester: TagSuggester;

  static defaultProps: Pick<Props, 'route'> = { route: { screen: '' } };

  constructor(props: Props) {
    super(props);

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

  get currentScreenLink(): string {
    const routeWithoutPopup: Route = {
      ...this.props.route,
      popup: undefined,
      // Generally the fragment is targetting something in the popup so we
      // should drop that too. Not sure what to do if we ever find that we need
      // a fragment on a page and then a popup on top of that.
      fragment: undefined,
    };
    return URLFromRoute(routeWithoutPopup);
  }

  handleKeyDown(e: KeyboardEvent) {
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
      const toTitle = (str: string): string =>
        str[0].toUpperCase() + str.substring(1);
      title += ` - ${toTitle(this.props.route.popup)}`;
    }

    const activeTab: TabName | undefined = [
      'lookup',
      'edit-card',
      'review',
    ].includes(this.props.route.screen)
      ? (this.props.route.screen as TabName)
      : undefined;
    const tabPanelClass = activeTab ? '' : '-allhidden';

    // Review handling
    let remainingReviews: number | undefined;
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
                  <CardListContext.Provider value={this.cardList}>
                    <HomeScreenContainer />
                  </CardListContext.Provider>
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
                  activeTab={activeTab}
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

const mapStateToProps = (state: AppState) => ({
  route:
    state.route && state.route.history && state.route.history.length
      ? state.route.history[state.route.index]
      : {},
  activeCardId: state.selection.activeCardId,
  reviewProgress: getReviewProgress(state),
});

const mapDispatchToProps = (dispatch: Dispatch<Action>) => ({
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

interface OwnProps {
  dataStore: DataStore;
}

export const App = connect<
  Return<typeof mapStateToProps>,
  Return<typeof mapDispatchToProps>,
  OwnProps,
  AppState
>(
  mapStateToProps,
  mapDispatchToProps
)(AppInner);

export default App;
