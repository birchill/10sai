import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import ReviewState from '../review-states';
import * as reviewActions from '../actions/review';

import ReviewScreen from './ReviewScreen.jsx';

class ReviewScreenContainer extends React.Component {
  static get propTypes() {
    return {
      active: PropTypes.bool.isRequired,
      reviewState: PropTypes.symbol.isRequired,
      onNewReview: PropTypes.func.isRequired,
      queryAvailableCards: PropTypes.func.isRequired,
      maxNewCards: PropTypes.number,
      maxCards: PropTypes.number,
    };
  }

  constructor(props) {
    super(props);
    this.state = { loadingAvailableCards: true, availableCards: undefined };
  }

  componentDidMount() {
    if (
      this.props.reviewState === ReviewState.COMPLETE ||
      this.props.reviewState === ReviewState.IDLE
    ) {
      this.loadAvailableCards();
    }
  }

  componentWillReceiveProps(nextProps) {
    if (
      this.props.reviewState !== nextProps.reviewState &&
      (nextProps.reviewState === ReviewState.COMPLETE ||
        nextProps.reviewState === ReviewState.IDLE)
    ) {
      this.loadAvailableCards();
    }
  }

  loadAvailableCards() {
    this.setState({
      loadingAvailableCards: true,
      availableCards: undefined,
    });

    this.props.queryAvailableCards().then(availableCards => {
      // XXX How to detect if we have been unmounted at this point?
      this.setState({
        loadingAvailableCards: false,
        availableCards,
      });
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
});
const mapDispatchToProps = dispatch => ({
  onNewReview: (maxNewCards, maxCards) => {
    dispatch(reviewActions.newReview(maxNewCards, maxCards));
  },
});

export default connect(mapStateToProps, mapDispatchToProps)(
  ReviewScreenContainer
);
