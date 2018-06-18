import { AvailableCards, Card, Review } from '../model';

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

export interface NewReviewAction {
  type: 'NEW_REVIEW';
  maxCards: number;
  maxNewCards: number;
}

export function newReview(
  maxNewCards: number,
  maxCards: number
): NewReviewAction {
  return {
    type: 'NEW_REVIEW',
    maxCards,
    maxNewCards,
  };
}

export interface SetReviewLimitAction {
  type: 'SET_REVIEW_LIMIT';
  maxCards: number;
  maxNewCards: number;
}

export function setReviewLimit(
  maxNewCards: number,
  maxCards: number
): SetReviewLimitAction {
  return {
    type: 'SET_REVIEW_LIMIT',
    maxCards,
    maxNewCards,
  };
}

export interface SetReviewTimeAction {
  type: 'SET_REVIEW_TIME';
  reviewTime: Date;
}

export function setReviewTime(reviewTime: Date): SetReviewTimeAction {
  return {
    type: 'SET_REVIEW_TIME',
    reviewTime,
  };
}

export interface LoadReviewAction {
  type: 'LOAD_REVIEW';
  review: Review;
  initialReview?: boolean;
}

export function loadReview(review: Review): LoadReviewAction {
  return {
    type: 'LOAD_REVIEW',
    review,
  };
}

export function loadInitialReview(review: Review): LoadReviewAction {
  return {
    type: 'LOAD_REVIEW',
    review,
    initialReview: true,
  };
}

export interface ReviewLoadedAction {
  type: 'REVIEW_LOADED';
  cards: Card[];
  history?: Card[];
  failedCardsLevel1?: Card[];
  failedCardsLevel2?: Card[];
  initialReview: boolean;
  currentCardSeed: number;
  nextCardSeed: number;
}

// How much to weight seeds towards zero.
const WEIGHT_FACTOR = 1.4;

export function reviewLoaded(
  cards: Card[],
  history?: Card[],
  failedCardsLevel1?: Card[],
  failedCardsLevel2?: Card[],
  initialReview: boolean = false
): ReviewLoadedAction {
  return {
    type: 'REVIEW_LOADED',
    cards,
    history,
    failedCardsLevel1,
    failedCardsLevel2,
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

export interface ShowAnswerAction {
  type: 'SHOW_ANSWER';
}

export function showAnswer(): ShowAnswerAction {
  return { type: 'SHOW_ANSWER' };
}

export interface FailCardAction {
  type: 'FAIL_CARD';
  nextCardSeed: number;
}

export function failCard(): FailCardAction {
  return {
    type: 'FAIL_CARD',
    // Weight towards zero
    nextCardSeed: Math.pow(Math.random(), WEIGHT_FACTOR),
  };
}

export interface PassCardAction {
  type: 'PASS_CARD';
  nextCardSeed: number;
}

export function passCard(): PassCardAction {
  return {
    type: 'PASS_CARD',
    // Weight towards zero
    nextCardSeed: Math.pow(Math.random(), WEIGHT_FACTOR),
  };
}

export interface FinishUpdateProgressAction {
  type: 'FINISH_UPDATE_PROGRESS';
}

export function finishUpdateProgress(): FinishUpdateProgressAction {
  return {
    type: 'FINISH_UPDATE_PROGRESS',
  };
}

export interface QueryAvailableCardsAction {
  type: 'QUERY_AVAILABLE_CARDS';
}

export function queryAvailableCards(): QueryAvailableCardsAction {
  return {
    type: 'QUERY_AVAILABLE_CARDS',
  };
}

export interface UpdateAvailableCardsAction {
  type: 'UPDATE_AVAILABLE_CARDS';
  availableCards: AvailableCards;
}

export function updateAvailableCards(
  availableCards: AvailableCards
): UpdateAvailableCardsAction {
  return {
    type: 'UPDATE_AVAILABLE_CARDS',
    availableCards,
  };
}

export interface UpdateReviewCardAction {
  type: 'UPDATE_REVIEW_CARD';
  card: Card;
}

export function updateReviewCard(card: Card): UpdateReviewCardAction {
  return {
    type: 'UPDATE_REVIEW_CARD',
    card,
  };
}

export interface DeleteReviewCardAction {
  type: 'DELETE_REVIEW_CARD';
  id: string;
  nextCardSeed: number;
}

export function deleteReviewCard(id: string): DeleteReviewCardAction {
  return {
    type: 'DELETE_REVIEW_CARD',
    id,
    nextCardSeed: Math.pow(Math.random(), WEIGHT_FACTOR),
  };
}

export interface CancelReviewAction {
  type: 'CANCEL_REVIEW';
}

export function cancelReview(): CancelReviewAction {
  return { type: 'CANCEL_REVIEW' };
}

// TODO: failUpdateProgress
// TODO: failLoadReview (rename reviewLoaded to finishLoadReview?)
