import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import {
  getSyncDisplayState,
  SyncDisplayState,
} from '../sync/SyncDisplayState';
import { Card } from '../model';

import { HomeScreen } from './HomeScreen';
import { SyncState } from '../sync/reducer';

interface Props {
  syncState: SyncDisplayState;
}

interface HomeScreenContainerState {
  loading: boolean;
  hasCards: boolean;
}

class HomeScreenContainer extends React.PureComponent<
  Props,
  HomeScreenContainerState
> {
  static get contextTypes() {
    return { cardList: PropTypes.object };
  }

  constructor(props: Props) {
    super(props);
    this.state = { loading: true, hasCards: false };

    this.handleCardsChange = this.handleCardsChange.bind(this);
  }

  componentDidMount() {
    this.context.cardList.getCards().then((cards: Array<Card>) => {
      this.setState({ loading: false });
      if (cards.length) {
        this.setState({ hasCards: true });
      }
    });

    this.context.cardList.subscribe(this.handleCardsChange);
  }

  componentWillUnmount() {
    this.context.cardList.unsubscribe(this.handleCardsChange);
  }

  handleCardsChange(cards: Array<Card>) {
    if (cards.length && !this.state.hasCards) {
      this.setState({ hasCards: true });
    } else if (!cards.length && this.state.hasCards) {
      this.setState({ hasCards: false });
    }
  }

  render() {
    return (
      <HomeScreen
        loading={this.state.loading}
        hasCards={this.state.hasCards}
        syncState={this.props.syncState}
      />
    );
  }
}

interface State {
  sync: SyncState;
}

const mapStateToProps = (state: State) => ({
  syncState: getSyncDisplayState(state.sync),
});

export default connect(mapStateToProps)(HomeScreenContainer);
