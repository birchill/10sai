/* global afterEach, beforeEach, describe, it */
/* eslint arrow-body-style: [ "off" ] */
// @format

import memdown from 'memdown';
import { assert } from 'chai';
import CardStore from '../src/CardStore';

describe('CardStore progress reporting', () => {
  let subject;

  beforeEach('setup new store', () => {
    subject = new CardStore({ db: memdown });
  });

  afterEach('clean up store', () => subject.destroy());

  it('creates a progress record when adding a new card', async () => {
    const card = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });
    assert.isTrue(await subject.hasProgressRecord(card._id));
  });
});
