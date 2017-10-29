export function newReview(maxNewCards, maxCards, reviewTime) {
  return {
    type: 'NEW_REVIEW',
    maxCards,
    maxNewCards,
    reviewTime,
  };
}

export function setReviewLimit(maxNewCards, maxCards) {
  return {
    type: 'SET_REVIEW_LIMIT',
    maxCards,
    maxNewCards,
  };
}

export function reviewLoaded(cards) {
  return {
    type: 'REVIEW_LOADED',
    cards,
    // The way we avoid caring about if these two overlap is that we assign the
    // current card and then remove it from the corresponding list. That way
    // nextCard is guaranteed to be different. This also helps with the case
    // where there is only one card left.
    // TODO: Weight these towards zero
    currentCardSeed: Math.random(),
    nextCardSeed: Math.random(),
  };
}

export function failCard(card) {
  return {
    type: 'FAIL_CARD',
    card,
    // TODO: Weight this towards zero
    nextCardSeed: Math.random(),
  };
}

export function passCard(card) {
  return {
    type: 'PASS_CARD',
    card,
    // TODO: Weight this towards zero
    nextCardSeed: Math.random(),
  };
}

// TODO: failUpdateProgress
// TODO: failLoadReview (rename reviewLoaded to finishLoadReview?)
