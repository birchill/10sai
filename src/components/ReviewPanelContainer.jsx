import { connect } from 'react-redux';

import ReviewState from '../review-states';
import * as reviewActions from '../review/actions';

import ReviewPanel from './ReviewPanel.jsx';

const mapStateToProps = state => {
  const { history } = state.review;
  const previousCard = history.length ? history[history.length - 1] : undefined;

  return {
    showAnswer: state.review.reviewState === ReviewState.ANSWER,
    previousCard,
    currentCard: state.review.currentCard,
    nextCard: state.review.nextCard,
  };
};

const mapDispatchToProps = dispatch => ({
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

const ReviewPanelContainer = connect(mapStateToProps, mapDispatchToProps)(
  ReviewPanel
);

export default ReviewPanelContainer;
