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

export function reviewLoaded(cards) {
  return {
    type: 'REVIEW_LOADED',
    cards,
    // The way we avoid caring about if these two overlap is that we assign the
    // current card and then remove if from the corresponding list. That way
    // nextCard is guaranteed to be different. This also helps with the case
    // where there is only one card left.
    currentCardSeed: Math.random(),
    nextCardSeed: Math.random(),
  };
}

// TODO: failCard -- needs to include the card
// TODO: passCard -- needs to include the card
// TODO: failUpdateProgress
// TODO: failLoadReview (rename reviewLoaded to finishLoadReview?)
