/* global define, it, describe */

import { assert } from 'chai';
import CardStore from '../src/CardStore';

describe('CardStore', () => {
  it('is initially empty', () => {
    const subject = new CardStore();

    return subject.getCards().then(cards => {
      assert.strictEqual(cards.length, 0, 'Length of getCards() result');
    });
  });
});
