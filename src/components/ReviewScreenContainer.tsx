import { Dispatch, Action } from 'redux';
import { connect } from 'react-redux';

import * as reviewActions from '../review/actions';
import { getReviewProgress } from '../review/selectors';

import { ReviewScreen } from './ReviewScreen';

// XXX Use the actual state once we have it
type State = any;

const mapStateToProps = (state: State) => ({
  phase: state.review.phase,
  availableCards: state.review.availableCards,
  // TODO: Actually get these from somewhere
  maxNewCards: 10,
  maxCards: 20,
  reviewProgress: getReviewProgress(state),
});

const mapDispatchToProps = (dispatch: Dispatch<Action<any>>) => ({
  onNewReview: (maxNewCards: number, maxCards: number) => {
    dispatch(reviewActions.newReview(maxNewCards, maxCards));
  },
});

export const ReviewScreenContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(ReviewScreen);
