import { Dispatch } from 'redux';
import { connect } from 'react-redux';

import * as Actions from '../actions';
import { getReviewProgress } from '../review/selectors';
import { AppState } from '../reducer';

import { ReviewScreen } from './ReviewScreen';

const mapStateToProps = (state: AppState) => ({
  phase: state.review.phase,
  availableCards: state.review.availableCards,
  // TODO: Actually get these from somewhere
  maxNewCards: 10,
  maxCards: 20,
  reviewProgress: getReviewProgress(state),
});

const mapDispatchToProps = (dispatch: Dispatch<Actions.Action>) => ({
  onNewReview: (maxNewCards: number, maxCards: number) => {
    dispatch(Actions.newReview(maxNewCards, maxCards));
  },
});

export const ReviewScreenContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(ReviewScreen);
