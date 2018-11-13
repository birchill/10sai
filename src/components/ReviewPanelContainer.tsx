import { Dispatch, Action } from 'redux';
import { connect } from 'react-redux';

import ReviewPhase from '../review/ReviewPhase';
import * as reviewActions from '../review/actions';

import ReviewPanel from './ReviewPanel';

// XXX Use the actual state once we have it
type State = any;

const mapStateToProps = (state: State) => {
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

const mapDispatchToProps = (dispatch: Dispatch<Action<any>>) => ({
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
