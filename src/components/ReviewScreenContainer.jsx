import { connect } from 'react-redux';

import * as reviewActions from '../review/actions.ts';
import { getReviewProgress } from '../review/selectors';

import ReviewScreen from './ReviewScreen.jsx';

const mapStateToProps = state => ({
  phase: state.review.phase,
  availableCards: state.review.availableCards,
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

export default connect(mapStateToProps, mapDispatchToProps)(ReviewScreen);
