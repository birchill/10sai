export function newReview(maxCards, maxNewCards) {
  return {
    type: 'NEW_REVIEW',
    maxCards,
    maxNewCards,
  };
}

export function reviewLoaded(newCards, overdueCards) {
  return {
    type: 'REVIEW_LOADED',
    newCards,
    overdueCards,
  };
}

// TODO: setReviewLimits
// TODO: failCard -- needs to include the card
// TODO: passCard -- needs to include the card
// TODO: failUpdateProgress
