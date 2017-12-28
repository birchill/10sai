import { collate } from 'pouchdb-collate';

// A simple wrapper around CardStore that represents a particular view onto the
// cards performing incremental updates to the view in response to change
// events (without having to re-query the database).

// Perform a binary search in |cards| for card with _id |id|.
//
// Returns a pair [found, index]. If |found| is true, |index| is the index of
// matching card in |cards|. If |found| is false, |index| is the index to use
// such that cards.splice(index, 0, card) would keep |cards| sorted.

const findCard = (id, cards) => {
  let min = 0;
  let max = cards.length - 1;
  let guess;

  while (min <= max) {
    guess = Math.floor((min + max) / 2);

    const result = collate(cards[guess]._id, id);

    if (result === 0) {
      return [true, guess];
    }

    if (result > 0) {
      min = guess + 1;
    } else {
      max = guess - 1;
    }
  }

  return [false, Math.max(min, max)];
};

class CardList {
  constructor(cardStore) {
    this.cardStore = cardStore;

    this.cards = [];
    this.listeners = [];

    this.initDone = this.cardStore.getCards().then(cards => {
      this.cards = cards;
    });

    this.cardStore.changes.on('change', change => {
      const cards = this.cards.slice();
      const [found, index] = findCard(change.id, cards);
      if (found) {
        if (change.deleted) {
          cards.splice(index, 1);
        } else {
          cards[index] = change.doc;
        }
        this.cards = cards;
        this.notifyListeners();
      } else if (!change.deleted) {
        cards.splice(index, 0, change.doc);
        this.cards = cards;
        this.notifyListeners();
      }
    });
  }

  async getCards() {
    return this.initDone.then(() => this.cards);
  }

  subscribe(listener) {
    // We should only have 1~2 listeners so we just do a linear search
    if (this.listeners.indexOf(listener) !== -1) {
      return;
    }

    this.listeners.push(listener);
  }

  unsubscribe(listener) {
    const index = this.listeners.indexOf(listener);
    if (index === -1) {
      return;
    }

    this.listeners.splice(index, 1);
  }

  notifyListeners() {
    const { cards } = this;
    for (const listener of this.listeners) {
      listener(cards);
    }
  }
}

export default CardList;
