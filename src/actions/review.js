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
  };
}

// TODO: setReviewLimits
// TODO: failCard -- needs to include the card
// TODO: passCard -- needs to include the card
// TODO: failUpdateProgress
