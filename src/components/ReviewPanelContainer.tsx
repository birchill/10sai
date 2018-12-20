import { Dispatch, Action } from 'redux';
import { connect } from 'react-redux';

import { ReviewPhase } from '../review/ReviewPhase';
import * as reviewActions from '../review/actions';
import * as routeActions from '../route/actions';
import { AppState } from '../reducer';

import { ReviewPanel } from './ReviewPanel';

const mapStateToProps = (state: AppState) => {
  const { history } = state.review;
  const previousCard = history.length ? history[history.length - 1] : undefined;

  return {
    showAnswer: state.review.phase === ReviewPhase.Answer,
    previousCard,
    currentCard: state.review.currentCard,
    nextCard: state.review.nextCard,
    notes: state.review.notes,
  };
};

const mapDispatchToProps = (dispatch: Dispatch<Action<any>>) => ({
  onShowAnswer: () => {
    dispatch(reviewActions.showAnswer());
  },
  onPassCard: () => {
    dispatch(reviewActions.passCard());
  },
  onFailCard: () => {
    dispatch(reviewActions.failCard());
  },
  onEditCard: (id: string) => {
    dispatch(routeActions.followLink(`/cards/${id}`, 'forwards', false));
  },
});

export const ReviewPanelContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(ReviewPanel);
