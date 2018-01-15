import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import ReviewState from '../review/states';
import * as reviewActions from '../review/actions';
import { getReviewProgress } from '../review/selectors';

import ReviewScreen from './ReviewScreen.jsx';

class ReviewScreenContainer extends React.PureComponent {
  static get propTypes() {
    return {
      active: PropTypes.bool.isRequired,
      reviewState: PropTypes.symbol.isRequired,
      onNewReview: PropTypes.func.isRequired,
      syncListener: PropTypes.shape({
        subscribe: PropTypes.func.isRequired,
        unsubscribe: PropTypes.func.isRequired,
      }).isRequired,
      maxNewCards: PropTypes.number,
      maxCards: PropTypes.number,
      reviewProgress: PropTypes.shape({
        failedCardsLevel1: PropTypes.number.isRequired,
        failedCardsLevel2: PropTypes.number.isRequired,
        completedCards: PropTypes.number.isRequired,
        unreviewedCards: PropTypes.number.isRequired,
      }),
    };
  }

  constructor(props) {
    super(props);
    this.state = { loadingAvailableCards: true, availableCards: undefined };
    this.watchingAvailableCards = false;
    this.updateAvailableCards = this.updateAvailableCards.bind(this);
  }

  componentDidMount() {
    if (
      this.props.reviewState === ReviewState.COMPLETE ||
      this.props.reviewState === ReviewState.IDLE
    ) {
      this.watchAvailableCards();
    }
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.reviewState === nextProps.reviewState) {
      return;
    }

    // We only watch for available cards while we're complete / idle.
    //
    // (Bear in mind that ReviewState.LOADING here means "Loading a review"
    // unlike in ReviewScreen where it means *either* "Loading a review" OR
    // "Loading available cards for the first time in a while".)
    if (
      nextProps.reviewState === ReviewState.COMPLETE ||
      nextProps.reviewState === ReviewState.IDLE
    ) {
      this.watchAvailableCards();
    } else {
      this.unwatchAvailableCards();
    }
  }

  componentWillUnmount() {
    this.unwatchAvailableCards();
  }

  unwatchAvailableCards() {
    if (!this.watchingAvailableCards) {
      return;
    }

    this.props.syncListener.unsubscribe(
      'availableCards',
      this.updateAvailableCards
    );
    this.watchingAvailableCards = false;
  }

  watchAvailableCards() {
    if (this.watchingAvailableCards) {
      return;
    }

    this.setState({
      loadingAvailableCards: true,
      availableCards: undefined,
    });

    this.props.syncListener.subscribe(
      'availableCards',
      this.updateAvailableCards
    );
    this.watchingAvailableCards = true;
  }

  updateAvailableCards(availableCards) {
    this.setState({
      loadingAvailableCards: false,
      availableCards,
    });
  }

  render() {
    const reviewState =
      this.state.loadingAvailableCards &&
      (this.props.reviewState === ReviewState.IDLE ||
        this.props.reviewState === ReviewState.COMPLETE)
        ? ReviewState.LOADING
        : this.props.reviewState;

    return (
      <ReviewScreen
        active={this.props.active}
        reviewState={reviewState}
        availableCards={this.state.availableCards}
        maxNewCards={this.props.maxNewCards}
        maxCards={this.props.maxCards}
        reviewProgress={this.props.reviewProgress}
        onNewReview={this.props.onNewReview}
      />
    );
  }
}

const mapStateToProps = state => ({
  reviewState: state.review.reviewState,
  // TODO: Actually get these from somewhere
  maxNewCards: 10,
  maxCards: 20,
  reviewProgress: getReviewProgress(state),
});

const mapDispatchToProps = dispatch => ({
  onNewReview: (maxNewCards, maxCards) => {
    dispatch(reviewActions.newReview(maxNewCards, maxCards));
  },
  onSelectCard: () => {
    dispatch(reviewActions.showAnswer());
  },
  onPassCard: () => {
    dispatch(reviewActions.passCard());
  },
  onFailCard: () => {
    dispatch(reviewActions.failCard());
  },
});

export default connect(mapStateToProps, mapDispatchToProps)(
  ReviewScreenContainer
);
