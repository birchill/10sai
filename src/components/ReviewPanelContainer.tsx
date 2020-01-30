import { Dispatch } from 'redux';
import { connect } from 'react-redux';

import { ReviewPhase } from '../review/review-phase';
import * as Actions from '../actions';
import { AppState } from '../reducer';

import { ReviewPanel } from './ReviewPanel';

interface Props {
  active: boolean;
}

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
  onPassCard: ({ confidence }: { confidence: number }) => {
    dispatch(Actions.passCard({ confidence }));
  },
  onFailCard: () => {
    dispatch(Actions.failCard());
  },
  onEditCard: (id: string) => {
    dispatch(Actions.followLink(`/cards/${id}`, 'forwards', false));
  },
});

export const ReviewPanelContainer = connect<
  ReturnType<typeof mapStateToProps>,
  ReturnType<typeof mapDispatchToProps>,
  Props,
  AppState
>(mapStateToProps, mapDispatchToProps, null, { forwardRef: true })(ReviewPanel);
