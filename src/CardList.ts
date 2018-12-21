import { collate } from 'pouchdb-collate';
import { Card } from './model';
import { DataStore } from './store/DataStore';
import { CardChange } from './store/CardStore';

// A simple wrapper around a Store that represents a particular view onto the
// cards performing incremental updates to the view in response to change
// events (without having to re-query the database).

// Perform a binary search in |cards| for card with id |id|.
//
// Returns a pair [found, index]. If |found| is true, |index| is the index of
// matching card in |cards|. If |found| is false, |index| is the index to use
// such that cards.splice(index, 0, card) would keep |cards| sorted.

const findCard = (id: string, cards: Card[]): [boolean, number] => {
  let min = 0;
  let max = cards.length - 1;
  let guess: number;

  while (min <= max) {
    guess = Math.floor((min + max) / 2);

    const result = collate(cards[guess].id, id);

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

type CardListListener = (cards: Card[]) => void;

export class CardList {
  dataStore: DataStore;
  cards: Card[];
  listeners: CardListListener[];
  initDone: Promise<void>;

  constructor(dataStore: DataStore) {
    this.dataStore = dataStore;

    this.cards = [];
    this.listeners = [];

    this.initDone = this.dataStore.getCards().then(cards => {
      this.cards = cards;
    });

    this.dataStore.changes.on('card', (change: CardChange) => {
      const cards = this.cards.slice();
      const [found, index] = findCard(change.card.id, cards);
      if (found) {
        if (change.deleted) {
          cards.splice(index, 1);
        } else {
          cards[index] = change.card as Card;
        }
        this.cards = cards;
        this.notifyListeners();
      } else if (!change.deleted) {
        cards.splice(index, 0, change.card as Card);
        this.cards = cards;
        this.notifyListeners();
      }
    });
  }

  async getCards() {
    return this.initDone.then(() => this.cards);
  }

  subscribe(listener: CardListListener) {
    // We should only have 1~2 listeners so we just do a linear search
    if (this.listeners.indexOf(listener) !== -1) {
      return;
    }

    this.listeners.push(listener);
  }

  unsubscribe(listener: CardListListener) {
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
