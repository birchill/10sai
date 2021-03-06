import {
  AvailableCards,
  Card,
  CardPlaceholder,
  ReviewSummary,
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

export function loadReview({ review }: { review: ReviewSummary }) {
  return {
    type: <const>'LOAD_REVIEW',
    review,
  };
}

export type LoadReviewAction = ReturnType<typeof loadReview>;

export type ReviewedCard = {
  card: Card | CardPlaceholder;
  status: 'passed' | 'failed';
  previousProgress?: Progress;
};

export function reviewCardsLoaded({
  history,
  newCards,
  overdue,
  seed = Math.random(),
}: {
  history: Array<ReviewedCard>;
  newCards: Array<Card>;
  overdue: Array<Card>;
  seed?: number;
}) {
  return {
    type: <const>'REVIEW_CARDS_LOADED',
    history,
    newCards,
    overdue,
    seed,
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

export function navigateReviewBack() {
  return { type: <const>'NAVIGATE_REVIEW_BACK' };
}

export type NavigateReviewBack = ReturnType<typeof navigateReviewBack>;

export function navigateReviewForward() {
  return { type: <const>'NAVIGATE_REVIEW_FORWARD' };
}

export type NavigateReviewForward = ReturnType<typeof navigateReviewForward>;

export type ReviewAction =
  | NewReviewAction
  | LoadReviewAction
  | ReviewCardsLoadedAction
  | ShowAnswerAction
  | FailCardAction
  | PassCardAction
  | FinishUpdateProgressAction
  | UpdateAvailableCardsAction
  | UpdateReviewCardAction
  | DeleteReviewCardAction
  | CancelReviewAction
  | NavigateReviewBack
  | NavigateReviewForward;

// TODO: failUpdateProgress
// TODO: failLoadReview (rename reviewLoaded to finishLoadReview?)
