import * as React from 'react';
import { connect } from 'react-redux';

import {
  getSyncDisplayState,
  SyncDisplayState,
} from '../sync/SyncDisplayState';
import { Card } from '../model';
import { CardListContext } from './CardListContext';

import { HomeScreen } from './HomeScreen';
import { AppState } from '../reducer';
import { CardList } from '../CardList';

interface PropsInner {
  syncState: SyncDisplayState;
  cardList: CardList;
}

interface StateInner {
  loading: boolean;
  hasCards: boolean;
}

class HomeScreenContainerInner extends React.PureComponent<
  PropsInner,
  StateInner
> {
  constructor(props: PropsInner) {
    super(props);

    this.state = { loading: true, hasCards: false };

    this.handleCardsChange = this.handleCardsChange.bind(this);
  }

  componentDidMount() {
    this.props.cardList.getCards().then((cards: Array<Card>) => {
      this.setState({ loading: false });
      if (cards.length) {
        this.setState({ hasCards: true });
      }
    });

    this.props.cardList.subscribe(this.handleCardsChange);
  }

  componentWillUnmount() {
    this.props.cardList.unsubscribe(this.handleCardsChange);
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

interface Props {
  syncState: SyncDisplayState;
}

const mapStateToProps = (state: AppState): Props => ({
  syncState: getSyncDisplayState(state.sync),
});

export const HomeScreenContainer = connect(mapStateToProps)((props: Props) => (
  <CardListContext.Consumer>
    {(cardList: CardList) => (
      <HomeScreenContainerInner cardList={cardList} {...props} />
    )}
  </CardListContext.Consumer>
));
