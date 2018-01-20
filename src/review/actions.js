export function newReview(maxNewCards, maxCards) {
  return {
    type: 'NEW_REVIEW',
    maxCards,
    maxNewCards,
  };
}

export function setReviewLimit(maxNewCards, maxCards) {
  return {
    type: 'SET_REVIEW_LIMIT',
    maxCards,
    maxNewCards,
  };
}

export function setReviewTime(reviewTime) {
  return {
    type: 'SET_REVIEW_TIME',
    reviewTime,
  };
}

// How much to weight seeds towards zero.
const WEIGHT_FACTOR = 1.4;

export function reviewLoaded(cards) {
  return {
    type: 'REVIEW_LOADED',
    cards,
    // The way we avoid caring about if these two overlap is that we assign the
    // current card and then remove it from the corresponding list. That way
    // nextCard is guaranteed to be different. This also helps with the case
    // where there is only one card left.

    // Weight towards zero
    currentCardSeed: Math.pow(Math.random(), WEIGHT_FACTOR),
    nextCardSeed: Math.pow(Math.random(), WEIGHT_FACTOR),
  };
}

export function showAnswer() {
  return { type: 'SHOW_ANSWER' };
}

export function failCard() {
  return {
    type: 'FAIL_CARD',
    // Weight towards zero
    nextCardSeed: Math.pow(Math.random(), WEIGHT_FACTOR),
  };
}

export function passCard() {
  return {
    type: 'PASS_CARD',
    // Weight towards zero
    nextCardSeed: Math.pow(Math.random(), WEIGHT_FACTOR),
  };
}

export function queryAvailableCards() {
  return {
    type: 'QUERY_AVAILABLE_CARDS',
  };
}

export function updateAvailableCards(availableCards) {
  return {
    type: 'UPDATE_AVAILABLE_CARDS',
    availableCards,
  };
}

export function updateReviewCard(card) {
  return {
    type: 'UPDATE_REVIEW_CARD',
    card,
  };
}

// TODO: failUpdateProgress
// TODO: failLoadReview (rename reviewLoaded to finishLoadReview?)
