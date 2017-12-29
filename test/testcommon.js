const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function waitForEvents(cycles = 1) {
  return new Promise(resolve => {
    (function wait() {
      if (--cycles) {
        setTimeout(wait, 0);
      } else {
        setImmediate(resolve);
      }
    })();
  });
}

// Generates a set of cards with increasing IDs / metadata.
//
// |maxNewCards| indicates the number of cards with no progress information to
// generate (but never more than |maxExistingCards|).
// |maxExistingCards| indicates the total number of cards to generate.
//
// Non-new cards will have a review time 3 days before the passed-in
// |reviewTime|.
export function generateCards(
  maxNewCards,
  maxExistingCards,
  reviewTime = new Date()
) {
  const cards = new Array(Math.max(maxNewCards, maxExistingCards));
  for (let i = 0; i < cards.length; i++) {
    const newCard = i < maxNewCards;
    cards[i] = {
      _id: `card${i + 1}`,
      question: `Question ${i + 1}`,
      answer: `Answer ${i + 1}`,
      progress: {
        level: newCard ? 0 : 1,
        reviewed: newCard ? null : new Date(reviewTime - 3 * MS_PER_DAY),
      },
    };
  }
  return cards;
}
