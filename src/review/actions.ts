import { AvailableCards, Card, Review } from '../model';

export function newReview(maxNewCards: number, maxCards: number) {
  return {
    type: <const>'NEW_REVIEW',
    maxCards,
    maxNewCards,
  };
}

export type NewReviewAction = ReturnType<typeof newReview>;

export function setReviewLimit(maxNewCards: number, maxCards: number) {
  return {
    type: <const>'SET_REVIEW_LIMIT',
    maxCards,
    maxNewCards,
  };
}

export type SetReviewLimitAction = ReturnType<typeof setReviewLimit>;

export function setReviewTime(reviewTime: Date) {
  return {
    type: <const>'SET_REVIEW_TIME',
    reviewTime,
  };
}

export type SetReviewTimeAction = ReturnType<typeof setReviewTime>;

export function loadReview(review: Review) {
  return {
    type: <const>'LOAD_REVIEW',
    review,
  };
}

export function loadInitialReview(review: Review): LoadReviewAction {
  return {
    type: <const>'LOAD_REVIEW',
    review,
    initialReview: true,
  };
}

export type LoadReviewAction = ReturnType<typeof loadReview> & {
  initialReview?: boolean;
};

// How much to weight seeds towards zero.
const WEIGHT_FACTOR = 1.4;

export function reviewLoaded(
  cards: Card[],
  history?: Card[],
  failed?: Card[],
  initialReview: boolean = false
) {
  return {
    type: <const>'REVIEW_LOADED',
    cards,
    history,
    failed,
    initialReview,

    // The way we avoid caring about if these two overlap is that we assign the
    // current card and then remove it from the corresponding list. That way
    // nextCard is guaranteed to be different. This also helps with the case
    // where there is only one card left.

    // Weight towards zero
    currentCardSeed: Math.pow(Math.random(), WEIGHT_FACTOR),
    nextCardSeed: Math.pow(Math.random(), WEIGHT_FACTOR),
  };
}

export type ReviewLoadedAction = ReturnType<typeof reviewLoaded>;

export function showAnswer() {
  return { type: <const>'SHOW_ANSWER' };
}

export type ShowAnswerAction = ReturnType<typeof showAnswer>;

export function failCard() {
  return {
    type: <const>'FAIL_CARD',
    reviewTime: new Date(),
    // Weight towards zero
    nextCardSeed: Math.pow(Math.random(), WEIGHT_FACTOR),
  };
}

export type FailCardAction = ReturnType<typeof failCard>;

export function passCard() {
  return {
    type: <const>'PASS_CARD',
    reviewTime: new Date(),
    // Weight towards zero
    nextCardSeed: Math.pow(Math.random(), WEIGHT_FACTOR),
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

export function queryAvailableCards() {
  return {
    type: <const>'QUERY_AVAILABLE_CARDS',
  };
}

export type QueryAvailableCardsAction = ReturnType<typeof queryAvailableCards>;

export function updateAvailableCards(availableCards: AvailableCards) {
  return {
    type: <const>'UPDATE_AVAILABLE_CARDS',
    availableCards,
  };
}

export type UpdateAvailableCardsAction = ReturnType<
  typeof updateAvailableCards
>;

export function updateReviewCard(card: Card) {
  return {
    type: <const>'UPDATE_REVIEW_CARD',
    card,
  };
}

export type UpdateReviewCardAction = ReturnType<typeof updateReviewCard>;

export function deleteReviewCard(id: string) {
  return {
    type: <const>'DELETE_REVIEW_CARD',
    id,
    nextCardSeed: Math.pow(Math.random(), WEIGHT_FACTOR),
  };
}

export type DeleteReviewCardAction = ReturnType<typeof deleteReviewCard>;

export function cancelReview() {
  return { type: <const>'CANCEL_REVIEW' };
}

export type CancelReviewAction = ReturnType<typeof cancelReview>;

export type ReviewAction =
  | NewReviewAction
  | SetReviewLimitAction
  | SetReviewTimeAction
  | LoadReviewAction
  | ReviewLoadedAction
  | ShowAnswerAction
  | FailCardAction
  | PassCardAction
  | FinishUpdateProgressAction
  | QueryAvailableCardsAction
  | UpdateAvailableCardsAction
  | UpdateReviewCardAction
  | DeleteReviewCardAction
  | CancelReviewAction;

// TODO: failUpdateProgress
// TODO: failLoadReview (rename reviewLoaded to finishLoadReview?)
