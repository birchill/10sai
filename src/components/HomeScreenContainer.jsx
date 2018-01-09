import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import HomeScreen from './HomeScreen.jsx';

class HomeScreenContainer extends React.PureComponent {
  static get contextTypes() {
    return { cardList: PropTypes.object };
  }

  static get propTypes() {
    return {
      syncState: PropTypes.symbol.isRequired,
    };
  }

  constructor(props) {
    super(props);
    this.state = { loading: true, hasCards: false };

    this.handleCardsChange = this.handleCardsChange.bind(this);
  }

  componentDidMount() {
    this.context.cardList.getCards().then(cards => {
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

  handleCardsChange(cards) {
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

const mapStateToProps = state => ({ syncState: state.sync.state });

export default connect(mapStateToProps)(HomeScreenContainer);
