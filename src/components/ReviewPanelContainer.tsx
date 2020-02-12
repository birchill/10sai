import { Dispatch } from 'redux';
import { connect } from 'react-redux';

import * as Actions from '../actions';
import { AppState } from '../reducer';
import { ReviewPhase } from '../review/review-phase';

import { ReviewPanel } from './ReviewPanel';

interface Props {
  active: boolean;
}

const mapStateToProps = (state: AppState) => {
  const { queue, position } = state.review;

  // XXX Do something sort of error thing if the position is out of range, queue
  // is empty etc.

  // XXX These need to pass on the actual status
  // --- They should also fail because the types are wrong... ReviewPanel
  //     doesn't yet take a CardPlaceholder
  const currentCard = queue[position!].card;
  const previousCard = position! > 1 ? queue[position! - 1].card : undefined;
  const nextCard =
    position! < queue.length - 1 ? queue[position! + 1].card : undefined;

  return {
    showBack: state.review.phase === ReviewPhase.Back,
    previousCard,
    currentCard,
    nextCard,
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
