import {
  AvailableCards,
  Card,
  CardPlaceholder,
  Review,
  Progress,
} from '../model';

export function newReview({
  maxNewCards,
  maxCards,
}: {
  maxNewCards: number;
  maxCards: number;
}) {
  return {
    type: <const>'NEW_REVIEW',
    maxCards,
    maxNewCards,
  };
}

export type NewReviewAction = ReturnType<typeof newReview>;

export function loadReviewCards({ review }: { review: Review }) {
  return {
    type: <const>'LOAD_REVIEW_CARDS',
    review,
  };
}

export type LoadReviewCardsAction = ReturnType<typeof loadReviewCards>;

export type ReviewedCard = {
  card: Card | CardPlaceholder;
  state: 'passed' | 'failed';
  previousProgress?: Progress;
};

export function reviewCardsLoaded({
  history,
  unreviewed,
}: {
  history: Array<ReviewedCard>;
  unreviewed: Array<Card>;
}) {
  return {
    type: <const>'REVIEW_CARDS_LOADED',
    history,
    unreviewed,
  };
}

export type ReviewCardsLoadedAction = ReturnType<typeof reviewCardsLoaded>;

export function showAnswer() {
  return { type: <const>'SHOW_ANSWER' };
}

export type ShowAnswerAction = ReturnType<typeof showAnswer>;

export function failCard() {
  return {
    type: <const>'FAIL_CARD',
    reviewTime: new Date(),
  };
}

export type FailCardAction = ReturnType<typeof failCard>;

export function passCard({ confidence = 1 }: { confidence?: number } = {}) {
  return {
    type: <const>'PASS_CARD',
    reviewTime: new Date(),
    confidence,
    levelSeed: Math.random(),
  };
}

export type PassCardAction = ReturnType<typeof passCard>;

export function finishUpdateProgress() {
  return {
    type: <const>'FINISH_UPDATE_PROGRESS',
  };
}

export type FinishUpdateProgressAction = ReturnType<
  typeof finishUpdateProgress
>;

export function updateAvailableCards({
  availableCards,
}: {
  availableCards: AvailableCards;
}) {
  return {
    type: <const>'UPDATE_AVAILABLE_CARDS',
    availableCards,
  };
}

export type UpdateAvailableCardsAction = ReturnType<
  typeof updateAvailableCards
>;

export function updateReviewCard({ card }: { card: Card }) {
  return {
    type: <const>'UPDATE_REVIEW_CARD',
    card,
  };
}

export type UpdateReviewCardAction = ReturnType<typeof updateReviewCard>;

export function deleteReviewCard({
  id,
  replacement,
}: {
  id: string;
  replacement?: Card;
}) {
  return {
    type: <const>'DELETE_REVIEW_CARD',
    id,
    replacement,
  };
}

export type DeleteReviewCardAction = ReturnType<typeof deleteReviewCard>;

export function cancelReview() {
  return { type: <const>'CANCEL_REVIEW' };
}

export type CancelReviewAction = ReturnType<typeof cancelReview>;

export type ReviewAction =
  | NewReviewAction
  | LoadReviewCardsAction
  | ReviewCardsLoadedAction
  | ShowAnswerAction
  | FailCardAction
  | PassCardAction
  | FinishUpdateProgressAction
  | UpdateAvailableCardsAction
  | UpdateReviewCardAction
  | DeleteReviewCardAction
  | CancelReviewAction;

// TODO: failUpdateProgress
// TODO: failLoadReview (rename reviewLoaded to finishLoadReview?)
