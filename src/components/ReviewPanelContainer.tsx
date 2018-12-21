import { Dispatch } from 'redux';
import { connect } from 'react-redux';

import { ReviewPhase } from '../review/ReviewPhase';
import * as Actions from '../actions';
import { AppState } from '../reducer';

import { ReviewPanel } from './ReviewPanel';

const mapStateToProps = (state: AppState) => {
  const { history } = state.review;
  const previousCard = history.length ? history[history.length - 1] : undefined;

  return {
    showBack: state.review.phase === ReviewPhase.Back,
    previousCard,
    currentCard: state.review.currentCard,
    nextCard: state.review.nextCard,
    notes: state.review.notes,
  };
};

const mapDispatchToProps = (dispatch: Dispatch<Actions.Action>) => ({
  onShowBack: () => {
    dispatch(Actions.showAnswer());
  },
  onPassCard: () => {
    dispatch(Actions.passCard());
  },
  onFailCard: () => {
    dispatch(Actions.failCard());
  },
  onEditCard: (id: string) => {
    dispatch(Actions.followLink(`/cards/${id}`, 'forwards', false));
  },
});

export const ReviewPanelContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(ReviewPanel);
