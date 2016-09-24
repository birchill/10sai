/* global afterEach, beforeEach, define, describe, it */
/* eslint arrow-body-style: [ "off" ] */

import memdown from 'memdown';
import { assert } from 'chai';
import CardStore from '../src/CardStore';
import { waitForEvents } from './testcommon';

describe('CardStore', () => {
  let subject;

  beforeEach('setup new store', () => {
    subject = new CardStore({ db: memdown });
  });

  afterEach('clean up store', () => subject.destroy());

  it('is initially empty', () =>
    subject.getCards()
      .then(cards => {
        assert.strictEqual(cards.length, 0, 'Length of getCards() result');
      })
  );

  it('returns added cards', () =>
    subject.putCard({ question: 'Question', answer: 'Answer' })
      .then(() => subject.getCards())
      .then(cards => {
        assert.strictEqual(cards.length, 1, 'Length of getCards() result');
        assert.strictEqual(cards[0].question, 'Question');
        assert.strictEqual(cards[0].answer, 'Answer');
      })
  );

  it('generates unique ascending IDs', () => {
    let prevId = '';
    for (let i = 0; i < 100; i++) {
      const id = CardStore.generateCardId();
      assert.isAbove(id, prevId);
      prevId = id;
    }
  });

  it('returns added cards in order', () => {
    let id1;
    let id2;

    return subject.putCard({ question: 'Q1', answer: 'A1' })
      .then(card => { id1 = card._id; })
      .then(() => subject.putCard({ question: 'Q2', answer: 'A2' }))
      .then(card => { id2 = card._id; })
      .then(() => subject.getCards())
      .then(cards => {
        // Sanity check
        assert.notStrictEqual(id1, id2, 'Card IDs are unique');

        assert.strictEqual(cards.length, 2, 'Expected no. of cards');
        assert.strictEqual(cards[0]._id, id2,
                           'Card added last is returned first');
        assert.strictEqual(cards[1]._id, id1,
                           'Card added first is returned last');
      });
  });

  it('does not overwrite ID if provided', () =>
    subject.putCard({ question: 'Question', answer: 'Answer',
                      _id: 'abc' })
      .then(card => {
        assert.strictEqual(card._id, 'abc',
                           'ID returned from putCard is the one specified');
      })
      .then(() => subject.getCards())
      .then(cards => {
        assert.strictEqual(cards[0]._id, 'abc',
                           'ID returned from getCards is the one specified');
      })
  );

  it('reports added cards', () => {
    let addedCard;
    let updateInfo;

    subject.onUpdate(info => { updateInfo = info; });

    return subject.putCard({ question: 'Q1', answer: 'A1' })
      .then(card => { addedCard = card; })
      // Wait for a few rounds of events so the update can take place
      .then(() => waitForEvents(3))
      .then(() => {
        assert.isOk(updateInfo, 'Change was recorded');
        assert.strictEqual(updateInfo.id, addedCard._id,
                           'Reported change has correct ID');
      });
  });

  it('does not return deleted cards', () =>
    subject.putCard({ question: 'Question', answer: 'Answer' })
      .then(card => subject.deleteCard(card))
      .then(() => subject.getCards())
      .then(cards => {
        assert.strictEqual(cards.length, 0, 'Length of getCards() result');
      })
  );

  it('deletes the specified card', () => {
    let firstCard;
    return subject.putCard({ question: 'Question 1',
                             answer: 'Answer 1' })
      .then(card => { firstCard = card; })
      .then(() => subject.putCard({ question: 'Question 2',
                                    answer: 'Answer 2' }))
      .then(() => subject.deleteCard(firstCard))
      .then(() => subject.getCards())
      .then(cards => {
        assert.strictEqual(cards.length, 1, 'Length of getCards() result');
        assert.strictEqual(cards[0].question, 'Question 2');
        assert.strictEqual(cards[0].answer, 'Answer 2');
      });
  });

  it('reports an error when the card to be deleted cannot be found', () =>
    subject.deleteCard({ _id: 'abc' })
      .then(() => {
        assert.fail('Should have reported an error for missing card');
      })
      .catch(err => {
        assert.strictEqual(err.status, 404);
        assert.strictEqual(err.name, 'not_found');
        assert.strictEqual(err.message, 'missing');
        assert.strictEqual(err.reason, 'deleted');
      })
  );

  it('reports deleted cards', () => {
    let addedCard;
    let updateInfo;

    subject.onUpdate(info => { updateInfo = info; });

    return subject.putCard({ question: 'Question', answer: 'Answer' })
      .then(card => { addedCard = card; })
      .then(() => subject.deleteCard(addedCard))
      .then(() => waitForEvents(3))
      .then(() => {
        assert.strictEqual(updateInfo.id, addedCard._id,
                           'Reported change has correct ID');
        assert.isOk(updateInfo.deleted,
                    'Reported change is a delete record');
      });
  });

  // XXX Test that we still delete, even when the revision is old
  // (probably requires we implement change handling first)

  // XXX: Changes to cards
  it('updates the specified field of cards', () => {
  });

  it('reports changes to cards', () => {
  });

  it('updates cards even when the revision is old', () => {
  });
});
