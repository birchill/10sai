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
// generate (but never more than |maxCards|).
// |maxCards| indicates the total number of cards to generate.
//
// Non-new cards will have a review time 3 days before the passed-in
// |reviewTime|.
export function generateCards({
  maxNewCards,
  maxCards,
  reviewTime = Date.now(),
}: {
  maxNewCards: number;
  maxCards: number;
  reviewTime?: number;
}): { newCards: Array<Card>; overdue: Array<Card> } {
  const totalCards = Math.max(maxNewCards, maxCards, 0);

  const newCards: Array<Card> = [];
  for (let i = 0; i < maxNewCards; i++) {
    newCards.push({
      id: `card${i + 1}`,
      front: `Question ${i + 1}`,
      back: `Answer ${i + 1}`,
      progress: { level: 0, due: null },
    } as Card);
  }

  const overdue: Array<Card> = [];
  for (let i = newCards.length; i < totalCards; i++) {
    overdue.push({
      id: `card${i + 1}`,
      front: `Question ${i + 1}`,
      back: `Answer ${i + 1}`,
      progress: {
        level: 1,
        due: new Date(reviewTime - 2 * MS_PER_DAY),
      },
    } as Card);
  }

  return { newCards, overdue };
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
