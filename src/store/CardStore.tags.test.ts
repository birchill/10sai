/* global afterEach, beforeEach, describe, expect, it */

import PouchDB from 'pouchdb';

import { DataStore } from './DataStore';
import { CardStore } from './CardStore';
import { Card } from '../model';

PouchDB.plugin(require('pouchdb-adapter-memory'));

const getRandomString = (len: number): string =>
  (
    Array(len).join('0') +
    Math.floor(Math.random() * Math.pow(36, len)).toString(36)
  ).slice(-len);

// Helper function to generate random cards and put them
const putNewCardWithTags = (
  tags: string[],
  cardStore: CardStore
): Promise<Card> => {
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

  it('respects the limits set when returning tags', async () => {
    await putNewCardWithTags(['ABC', 'DEF', 'GHI'], subject);
    await putNewCardWithTags(['JKL', 'MNO', 'AAA'], subject);

    const tags = await subject.getTags('', 5);

    expect(tags).toEqual(['AAA', 'ABC', 'DEF', 'GHI', 'JKL']);
  });

  it('performs substring matches', async () => {
    await putNewCardWithTags(['AAA', 'ABC', 'ABD', 'AB', 'XYZ'], subject);

    const tags = await subject.getTags('AB', 5);

    expect(tags).toEqual(['AB', 'ABC', 'ABD']);
  });

  it('sorts exact matches first, then frequency', async () => {
    await putNewCardWithTags(['ABC', 'ABCD', 'ABCA'], subject);
    await putNewCardWithTags(['ABCD'], subject);
    await putNewCardWithTags(['ABCD'], subject);
    await putNewCardWithTags(['ABCA'], subject);

    // For frequency we now have:
    // - ABC:  1
    // - ABCD: 3
    // - ABCA: 2

    const tags = await subject.getTags('ABC', 5);

    expect(tags).toEqual(['ABC', 'ABCD', 'ABCA']);
  });

  it('sorts shorter strings before longer strings with the same frequency', async () => {
    await putNewCardWithTags(['ABCDE', 'ABCD', 'ABC'], subject);
    await putNewCardWithTags(['ABC', 'ABCD', 'ABCDE'], subject);

    const tags = await subject.getTags('ABC', 5);

    expect(tags).toEqual(['ABC', 'ABCD', 'ABCDE']);
  });

  it('sorts strings with the same frequency and length by locale', async () => {
    await putNewCardWithTags(['BBB', 'AAA', 'CCC'], subject);
    await putNewCardWithTags(['CCC', 'BBB', 'AAA'], subject);

    const tags = await subject.getTags('', 5);

    expect(tags).toEqual(['AAA', 'BBB', 'CCC']);
  });

  it('performs ASCII case-insensitive lookup', async () => {
    await putNewCardWithTags(['ABC', 'Abc', 'abc'], subject);
    await putNewCardWithTags(['abc', 'Abcd'], subject);

    const tags = await subject.getTags('Abc', 5);

    expect(tags).toEqual(['Abc', 'abc', 'ABC', 'Abcd']);
  });
});

// Helper function to generate random cards and put them
const putNewCardWithKeywords = (
  keywords: string[],
  cardStore: CardStore
): Promise<Card> => {
  return cardStore.putCard({
    question: getRandomString(5),
    answer: getRandomString(5),
    keywords,
    tags: [],
    starred: false,
  });
};

describe('CardStore:keywords', () => {
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

  //
  // The following tests are fairly naive since we just assume that most of the
  // code for dealing with keywords and tags is similar.
  //

  it('returns the most frequently used keywords', async () => {
    await putNewCardWithKeywords(['ABC', 'DEF', 'GHI'], subject);
    await putNewCardWithKeywords(['DEF'], subject);

    const keywords = await subject.getKeywords('', 5);

    expect(keywords).toEqual(['DEF', 'ABC', 'GHI']);
  });
});
