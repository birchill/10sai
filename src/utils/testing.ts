import { Card } from '../model';

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
  maxNewCards: number,
  maxExistingCards: number,
  reviewTime: number = Date.now()
) {
  const cards = new Array(Math.max(maxNewCards, maxExistingCards));
  for (let i = 0; i < cards.length; i++) {
    const newCard = i < maxNewCards;
    cards[i] = {
      id: `card${i + 1}`,
      front: `Question ${i + 1}`,
      back: `Answer ${i + 1}`,
      progress: {
        level: newCard ? 0 : 1,
        due: newCard ? null : new Date(reviewTime - 2 * MS_PER_DAY),
      },
    };
  }
  return cards;
}

// Generates a complete Card with id |id| and all other members filled in with
// dummy values.
export function generateCard(id: string): Card {
  return {
    id,
    front: 'Question',
    back: 'Answer',
    keywords: [],
    tags: [],
    starred: false,
    created: Date.now(),
    modified: Date.now(),
    progress: {
      level: 1,
      due: new Date(Date.now() + 1 * MS_PER_DAY),
    },
  };
}
