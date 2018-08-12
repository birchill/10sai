import { connect } from 'react-redux';

import ReviewPhase from '../review/ReviewPhase.ts';
import * as reviewActions from '../review/actions.ts';

import ReviewPanel from './ReviewPanel.jsx';

const mapStateToProps = state => {
  const { history } = state.review;
  const previousCard = history.length ? history[history.length - 1] : undefined;

  return {
    showAnswer: state.review.phase === ReviewPhase.ANSWER,
    previousCard,
    currentCard: state.review.currentCard,
    nextCard: state.review.nextCard,
    notes: state.review.notes,
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

const ReviewPanelContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(ReviewPanel);

export default ReviewPanelContainer;
