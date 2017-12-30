import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import ReviewState from '../review-states';

import ReviewScreen from './ReviewScreen.jsx';

class ReviewScreenContainer extends React.Component {
  static get propTypes() {
    return {
      reviewState: PropTypes.symbol.isRequired,
      active: PropTypes.bool.isRequired,
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
    return (
      <ReviewScreen
        active={this.props.active}
        reviewState={this.props.reviewState}
        availabilityLoading={this.state.loadingAvailableCards}
        availableCards={this.state.availableCards}
        maxNewCards={this.props.maxNewCards}
        maxCards={this.props.maxCards}
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

export default connect(mapStateToProps)(ReviewScreenContainer);
