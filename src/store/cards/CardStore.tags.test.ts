/* global afterEach, beforeEach, describe, expect, it */
/* eslint arrow-body-style: [ "off" ] */

import PouchDB from 'pouchdb';

import DataStore from '../DataStore';
import CardStore from './CardStore';

PouchDB.plugin(require('pouchdb-adapter-memory'));

// Helper function to generate random cards and put them
const putNewCardWithTags = (
  tags: string[],
  cardStore: CardStore
): Promise<Card> => {
  const getRandomString = (len: number): string =>
    (
      Array(len).join('0') +
      Math.floor(Math.random() * Math.pow(36, len)).toString(36)
    ).slice(-len);
  return cardStore.putCard({
    question: getRandomString(5),
    answer: getRandomString(5),
    keywords: [],
    tags,
    starred: false,
  });
};

describe('CardStore:tags', () => {
  let dataStore: DataStore;
  let subject: CardStore;

  beforeEach(() => {
    dataStore = new DataStore({
      pouch: { adapter: 'memory' },
      prefetchViews: false,
    });
    subject = dataStore.cardStore;
  });

  afterEach(() => dataStore.destroy());

  it('returns the most frequently used tags', async () => {
    await putNewCardWithTags(['ABC', 'DEF'], subject); // ABC: 1, DEF: 1
    await putNewCardWithTags(['ABC'], subject); // ABC: 2, DEF: 1
    await putNewCardWithTags(['DEF'], subject); // ABC: 1, DEF: 2
    await putNewCardWithTags(['JKY'], subject); // ABC: 2, DEF: 2, JKY: 1
    await putNewCardWithTags([], subject); // ABC: 2, DEF: 2, JKY: 2
    await putNewCardWithTags(['DEF'], subject); // ABC: 2, DEF: 3, JKY: 1

    const tags = await subject.getTags('', 5);

    expect(tags).toEqual(['DEF', 'ABC', 'JKY']);
  });

  // XXX Respects the limits passed in
  // XXX Performs substring matches
  //    -- In descending order
  // XXX Sorts exact matches first
  // XXX Sorts shorter strings before longer strings with same frequency
  // XXX Sorts strings with the same frequency and length by locale
});
