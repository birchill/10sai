import { Dispatch } from 'redux';
import { connect } from 'react-redux';

import * as Actions from '../actions';
import { isCardPlaceholder } from '../model';
import { AppState } from '../reducer';

import { ReviewPanel } from './ReviewPanel';

interface Props {
  active: boolean;
}

const mapStateToProps = (state: AppState) => {
  const { queue, position } = state.review;

  // XXX Introduce an error boundary to handle this

  if (
    typeof position === 'undefined' ||
    position < 0 ||
    position >= queue.length
  ) {
    throw new Error(
      `Invalid queue position: ${position} (queue length: ${queue.length}`
    );
  }

  // The navigation actions should always ensure we are pointing to an actual
  // card.
  const currentCard = queue[position];
  if (isCardPlaceholder(currentCard.card)) {
    throw new Error('Current card is a placeholder');
  }

  let prevPosition = position - 1;
  while (prevPosition >= 0 && isCardPlaceholder(queue[prevPosition].card)) {
    prevPosition--;
  }
  const previousCard = prevPosition >= 0 ? queue[prevPosition] : undefined;

  let nextPosition = position + 1;
  while (
    nextPosition < queue.length &&
    isCardPlaceholder(queue[nextPosition].card)
  ) {
    nextPosition++;
  }
  const nextCard =
    nextPosition < queue.length ? queue[nextPosition] : undefined;

  return {
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
