import * as views from './views';

import { Card, Progress } from '../../model';
import { CARD_PREFIX, PROGRESS_PREFIX } from './records';
import { CardRecord, ProgressRecord } from './records';
import { DeepPartial, MakeOptional, Omit } from '../../utils/type-helpers';
import { generateUniqueTimestampId, stubbornDelete } from '../utils';

const stripCardPrefix = (id: string) => id.substr(CARD_PREFIX.length);
const stripProgressPrefix = (id: string) => id.substr(PROGRESS_PREFIX.length);

// Take a card from the DB and turn it into a more appropriate form for
// client consumption
const parseCard = (card: CardRecord): Omit<Card, 'progress'> => {
  const result = {
    ...card,
    _id: stripCardPrefix(card._id),
    keywords: card.keywords || [],
    tags: card.tags || [],
    starred: !!card.starred,
    // We deliberately *don't* parse the 'created' or 'modified' fields into
    // Date objects since they're currently not used in the app and so
    // speculatively parsing them would be a waste.
  };
  delete result._rev;
  return result;
};

const parseProgress = (progress: ProgressRecord): Progress => {
  const result = {
    ...progress,
    reviewed: progress.reviewed ? new Date(progress.reviewed) : null,
  };
  delete result._id;
  delete result._rev;

  return result;
};

const mergeRecords = (card: CardRecord, progress: ProgressRecord): Card => {
  const result = {
    ...parseCard(card),
    progress: parseProgress(progress),
  };

  return result;
};

export interface GetCardsOptions {
  limit?: number;
  type?: 'new' | 'overdue';
  skipFailedCards?: boolean;
}

export type CardChange = MakeOptional<Card, 'progress'> &
  PouchDB.Core.ChangesMeta;

type EmitFunction = (type: string, ...args: any[]) => void;

interface CardStoreOptions {
  prefetchViews?: boolean;
}

interface LazyPromise {
  promise: Promise<void>;
  resolve: () => void;
  resolved: boolean;
}

interface ViewPromises {
  cards: LazyPromise;
  review: LazyPromise;
  keywords: LazyPromise;
  tags: LazyPromise;
}

interface StringsAndFrequency {
  value: number;
  key: string[2];
}

export class CardStore {
  db: PouchDB.Database;
  // Promises we use to wait on when we *first* create the different types of
  // views.
  viewPromises: ViewPromises;
  prefetchViews: boolean;
  returnedCards: {
    [id: string]: { cardRev: string; progressRev: string | null };
  };

  constructor(db: PouchDB.Database, options?: CardStoreOptions) {
    this.db = db;
    this.returnedCards = {};
    this.prefetchViews = <boolean>(options && options.prefetchViews);

    const getLazyPromise = (): LazyPromise => {
      let resolve: () => void;
      const promise = new Promise<void>(resolveFn => {
        resolve = resolveFn;
      });
      return { promise, resolve: resolve!, resolved: false };
    };

    this.viewPromises = {
      cards: getLazyPromise(),
      review: getLazyPromise(),
      keywords: getLazyPromise(),
      tags: getLazyPromise(),
    };
  }

  async getCards(options?: GetCardsOptions): Promise<Card[]> {
    const queryOptions: PouchDB.Query.Options<any, any> = {
      include_docs: true,
      descending: true,
    };
    if (options && typeof options.limit === 'number') {
      queryOptions.limit = options.limit;
    }

    let view = 'cards';
    const type = options ? options.type : '';
    if (type === 'new') {
      view = 'new_cards';
    } else if (type === 'overdue') {
      view = 'overdueness';
      queryOptions.endkey = 0;
      if (options && options.skipFailedCards) {
        // This really should be Number.MAX_VALUE - .0001 or something like
        // that but that doesn't seem to work and I haven't debugged far
        // enough into PouchDB to find out why.
        //
        // (Really getOverduenessFunction should use Infinity and this
        // should use Number.MAX_VALUE but that too doesn't work.)
        queryOptions.startkey = Number.MAX_SAFE_INTEGER;
      }
    }

    if (view === 'cards') {
      await this.viewPromises.cards.promise;
    } else {
      await this.viewPromises.review.promise;
    }

    const result = await this.db.query<CardRecord>(view, queryOptions);
    return result.rows.filter(row => row.doc).map(row => ({
      ...parseCard(row.doc!),
      progress: parseProgress(row.value.progress),
    }));
  }

  async getCardsById(ids: string[]): Promise<Card[]> {
    await this.viewPromises.cards.promise;

    const options = {
      keys: ids.map(id => PROGRESS_PREFIX + id),
      include_docs: true,
    };
    const result = await this.db.query<CardRecord>('cards', options);

    return result.rows.filter(row => row.doc).map(row => ({
      ...parseCard(row.doc!),
      progress: parseProgress(row.value.progress),
    }));
  }

  async getAvailableCards() {
    await this.viewPromises.review.promise;

    const overdueResult = await this.db.query('overdueness', {
      include_docs: false,
      startkey: 0,
    });
    const newResult = await this.db.query('new_cards', { include_docs: false });

    return {
      newCards: newResult.rows.length,
      overdueCards: overdueResult.rows.length,
    };
  }

  async putCard(card: DeepPartial<Card>): Promise<Card> {
    // New card
    if (!card._id) {
      return this._putNewCard(card);
    }

    const cardUpdate = { ...card };
    delete cardUpdate.progress;
    delete cardUpdate._id;
    const cardRecord = await this._updateCard(card._id, <Partial<
      Card
    >>cardUpdate);

    const progressUpdate = { ...card.progress };
    const progressRecord = await this._updateProgress(card._id, progressUpdate);

    return mergeRecords(cardRecord, progressRecord);
  }

  async _putNewCard(card: DeepPartial<Card>): Promise<Card> {
    const now = new Date().getTime();
    const cardToPut = {
      ...card,
      // Fill-in mandatory fields
      question: card.question || '',
      answer: card.answer || '',
      // Update dates
      created: now,
      modified: now,
    };

    // Drop empty optional fields
    if (cardToPut.keywords && !cardToPut.keywords.length) {
      delete cardToPut.keywords;
    }
    if (cardToPut.tags && !cardToPut.tags.length) {
      delete cardToPut.tags;
    }
    if (typeof cardToPut.starred !== 'undefined' && !cardToPut.starred) {
      delete cardToPut.starred;
    }

    if ('progress' in cardToPut) {
      delete cardToPut.progress;
    }

    const progressToPut: Omit<ProgressRecord, '_id' | '_rev'> = {
      reviewed:
        card.progress && card.progress.reviewed instanceof Date
          ? card.progress.reviewed.getTime()
          : null,
      level:
        card.progress && typeof card.progress.level !== 'undefined'
          ? card.progress.level
          : 0,
    };

    return (async function tryPutNewCard(
      card,
      progress,
      db,
      id
    ): Promise<Card> {
      let putCardResult;
      try {
        putCardResult = await db.put({ ...card, _id: CARD_PREFIX + id });
      } catch (err) {
        if (err.status !== 409) {
          throw err;
        }
        // If we put the card and there was a conflict, it must mean we
        // chose an overlapping ID. Just keep trying until it succeeds.
        return tryPutNewCard(card, progress, db, generateUniqueTimestampId());
      }

      const newCard: CardRecord = {
        ...card,
        _id: CARD_PREFIX + id,
        _rev: putCardResult.rev,
      };

      // Succeeded in putting the card. Now to add a corresponding progress
      // record. We have a unique card ID so there can't be any overlapping
      // progress record unless something is very wrong.
      const progressToPut = {
        reviewed: null,
        level: 0,
        ...progress,
        _id: PROGRESS_PREFIX + id,
      };
      try {
        await db.put(progressToPut);
      } catch (err) {
        console.error(`Unexpected error putting progress record: ${err}`);
        await db.remove({ _id: CARD_PREFIX + id, _rev: putCardResult.rev });
        throw err;
      }

      return mergeRecords(newCard, progressToPut);
    })(
      <Omit<CardRecord, '_id'>>cardToPut,
      progressToPut,
      this.db,
      generateUniqueTimestampId()
    );
  }

  async _updateCard(
    id: string,
    update: Partial<Omit<Card, 'progress'>>
  ): Promise<CardRecord> {
    let card: CardRecord | undefined;
    let missing = false;

    await this.db.upsert<CardRecord>(CARD_PREFIX + id, doc => {
      // Doc was not found -- must have been deleted
      if (!doc.hasOwnProperty('_id')) {
        missing = true;
        return false;
      }

      // If we ever end up speculatively parsing date fields into Date objects
      // in parseCard, then we'll need special handling here to make sure we
      // write and return the correct formats.
      card = {
        ...(<CardRecord>doc),
        ...update,
        _id: CARD_PREFIX + id,
      };

      if (!Object.keys(update).length) {
        return false;
      }

      if (update.keywords && !update.keywords.length) {
        delete card.keywords;
      }
      if (update.tags && !update.tags.length) {
        delete card.tags;
      }
      if (typeof update.starred !== 'undefined' && !update.starred) {
        delete card.starred;
      }

      card.modified = new Date().getTime();

      return card;
    });

    if (missing || !card) {
      const err: Error & { status?: number } = new Error('missing');
      err.status = 404;
      err.name = 'not_found';
      throw err;
    }

    return card;
  }

  async _updateProgress(
    id: string,
    update: Partial<Progress>
  ): Promise<ProgressRecord> {
    let progress: ProgressRecord | undefined;
    let missing = false;

    await this.db.upsert<ProgressRecord>(PROGRESS_PREFIX + id, doc => {
      // Doc was not found -- must have been deleted
      if (!doc.hasOwnProperty('_id')) {
        missing = true;
        return false;
      }

      progress = <ProgressRecord>doc;

      let hasChange = false;
      if (
        update &&
        update.reviewed &&
        update.reviewed instanceof Date &&
        progress!.reviewed !== update.reviewed.getTime()
      ) {
        progress!.reviewed = update.reviewed.getTime();
        hasChange = true;
      }
      if (
        update &&
        typeof update.level === 'number' &&
        progress!.level !== update.level
      ) {
        progress!.level = update.level;
        hasChange = true;
      }

      if (!hasChange) {
        return false;
      }

      return progress;
    });

    if (missing || !progress) {
      const err: Error & { status?: number } = new Error('missing');
      err.status = 404;
      err.name = 'not_found';
      throw err;
    }

    return progress;
  }

  async getCard(id: string): Promise<Card> {
    const card = await (<Promise<CardRecord>>this.db.get(CARD_PREFIX + id));
    const progress = await (<Promise<ProgressRecord>>this.db.get(
      PROGRESS_PREFIX + id
    ));
    return mergeRecords(card, progress);
  }

  async deleteCard(id: string) {
    await stubbornDelete(CARD_PREFIX + id, this.db);
    await stubbornDelete(PROGRESS_PREFIX + id, this.db);
  }

  async getKeywords(prefix: string, limit: number): Promise<string[]> {
    await this.viewPromises.keywords.promise;

    return this.getKeywordsOrTags('keywords', prefix, limit);
  }

  async getTags(prefix: string, limit: number): Promise<string[]> {
    await this.viewPromises.tags.promise;

    return this.getKeywordsOrTags('tags', prefix, limit);
  }

  async getKeywordsOrTags(
    view: string,
    prefix: string,
    limit: number
  ): Promise<string[]> {
    // We fetch a lot more records than requested since we want to return the
    // highest frequency records, not just the first |limit| keywords/tags that
    // match.
    //
    // For the prefix === '' case we should ideally look at *all* the
    // keywords/tags but I couldn't find an easy and efficient way to sort the
    // keywords/tags view by frequency AND by key so we can do the substring
    // lookup short of making two views so we just take the first 200
    // keywords/tags and return the highest frequency ones amongst them. If the
    // user has more than 200 unique keywords/tags then (a) they can probably
    // cope with not having the absolute optimal initial suggestions, and (b)
    // they're probably doing it wrong anyway.
    const minRecords = prefix === '' ? 200 : 40;

    const queryOptions: PouchDB.Query.Options<any, any> = {
      limit: Math.max(minRecords, limit),
      group: true,
      group_level: 2,
    };

    if (prefix !== '') {
      queryOptions.startkey = [prefix.toLowerCase()];
      queryOptions.endkey = [prefix.toLowerCase() + '\ufff0', {}];
    }

    const result = await this.db.query<StringsAndFrequency>(view, queryOptions);

    const comparator = CardStore.getKeywordsOrTagsComparator(prefix);
    return result.rows
      .sort(comparator)
      .map(entry => entry.key[1])
      .slice(0, limit);
  }

  static getKeywordsOrTagsComparator(prefix: string) {
    return (a: StringsAndFrequency, b: StringsAndFrequency): number => {
      const valueA = a.key[1];
      const valueB = b.key[1];

      // Sort exact matches first
      if (valueA === prefix) {
        return -1;
      }
      if (valueB === prefix) {
        return 1;
      }

      // Then sort by frequency
      if (a.value !== b.value) {
        return b.value - a.value;
      }
      // Within the set of equal frequency strings sort by length
      if (valueA.length !== valueB.length) {
        return valueA.length - valueB.length;
      }
      // Finally sort by string value
      return valueA.localeCompare(valueB);
    };
  }

  async updateViews(reviewTime: Date) {
    await this.updateCardsView();
    // If this is the first time we created the view, resolve the appropriate
    // promise.
    if (!this.viewPromises.cards.resolved) {
      this.viewPromises.cards.resolved = true;
      this.viewPromises.cards.resolve();
    }

    await this.updateNewCardsView();
    await this.updateOverduenessView(reviewTime);
    if (!this.viewPromises.review.resolved) {
      this.viewPromises.review.resolved = true;
      this.viewPromises.review.resolve();
    }

    await this.updateKeywordsView();
    if (!this.viewPromises.keywords.resolved) {
      this.viewPromises.keywords.resolved = true;
      this.viewPromises.keywords.resolve();
    }

    await this.updateTagsView();
    if (!this.viewPromises.tags.resolved) {
      this.viewPromises.tags.resolved = true;
      this.viewPromises.tags.resolve();
    }
  }

  async updateCardsView() {
    return this._updateMapView('cards', views.cardMapFunction);
  }

  async updateNewCardsView() {
    return this._updateMapView('new_cards', views.newCardMapFunction);
  }

  async updateKeywordsView() {
    return this._updateMapView('keywords', views.keywordMapFunction, '_sum');
  }

  async updateTagsView() {
    return this._updateMapView('tags', views.tagMapFunction, '_sum');
  }

  async _updateMapView(
    view: string,
    mapFunction: string,
    reduce: string | boolean = false
  ) {
    return this.db
      .upsert(
        `_design/${view}`,
        (currentDoc: PouchDB.Core.PostDocument<any>) => {
          const doc = {
            _id: `_design/${view}`,
            views: {
              [view]: {
                map: mapFunction,
                reduce: reduce ? reduce : false,
              },
            },
          };

          if (
            currentDoc &&
            currentDoc.views &&
            currentDoc.views[view] &&
            currentDoc.views[view].map &&
            currentDoc.views[view].map === doc.views[view].map
          ) {
            return false;
          }

          return doc;
        }
      )
      .then(result => {
        if (!result.updated || !this.prefetchViews) {
          return;
        }

        this.db.query(view, { limit: 0 }).catch(() => {
          // Ignore errors from this. We hit this often during unit tests where
          // we destroy the database before the query gets a change to run.
        });
      });
  }

  async updateOverduenessView(reviewTime: Date) {
    return this.db
      .upsert('_design/overdueness', () => ({
        _id: '_design/overdueness',
        views: {
          overdueness: {
            map: views.getOverduenessFunction(reviewTime),
          },
        },
      }))
      .then(() => {
        if (!this.prefetchViews) {
          return;
        }

        // Don't return the promise from this. Just trigger the query so it can
        // run in the background.
        this.db.query('overdueness', { limit: 0 }).catch(() => {
          // Ignore errors from this. We hit this often during unit tests where
          // we destroy the database before the query gets a change to run.
        });
      });
  }

  async updateReviewTime(reviewTime: Date) {
    await this.updateOverduenessView(reviewTime);
  }

  async onChange(
    change: PouchDB.Core.ChangesResponseChange<{}>,
    emit: EmitFunction
  ) {
    if (!change.doc) {
      return;
    }

    // When a new card is added we'll get a change callback for both the card
    // record and the progress record but, since we lookup the other half before
    // calling the callback, we'd end up calling the callback with the same
    // document twice. Likewise for any change that touches both records at
    // once.
    //
    // That's wasteful particularly if we are doing a big sync -- we'll end up
    // calling the callback twice as many times as we need to. Furthermore it's
    // exposing an implementation detail of this class that we should really
    // hide.
    //
    // To mediate that, we maintain a map of all the card/progress revisions we
    // have returned so we can avoid returning the same thing twice.
    const alreadyReturnedCard = (record: CardRecord | ProgressRecord) => {
      if (record._id.startsWith(CARD_PREFIX)) {
        const id = stripCardPrefix(record._id);
        return (
          this.returnedCards[id] &&
          this.returnedCards[id].cardRev === record._rev
        );
      } else if (record._id.startsWith(PROGRESS_PREFIX)) {
        const id = stripProgressPrefix(record._id);
        return (
          this.returnedCards[id] &&
          this.returnedCards[id].progressRev === record._rev
        );
      }
      return false;
    };

    if (change.doc._id.startsWith(CARD_PREFIX)) {
      const id = stripCardPrefix(change.doc._id);
      let progress;
      if (!change.doc._deleted) {
        try {
          progress = await this.db.get<ProgressRecord>(PROGRESS_PREFIX + id);
        } catch (e) {
          if (e.status === 404) {
            // If we can't find the progress record there are two
            // possibilities we know about:
            //
            // (a) It has been deleted. This happens normally as part of the
            //     deletion process and we just let |progress| be undefined
            //     in that case.
            //
            // (b) We haven't synced it yet. In that case just we will just
            //     wait until it syncs and report the change then.
            if (e.reason !== 'deleted') {
              return;
            }
          } else {
            throw e;
          }
        }
      }
      // We have to check this after the async call above since while
      // fetching the progress record, it might be reported here.
      if (alreadyReturnedCard(<CardRecord>change.doc)) {
        return undefined;
      }
      this.returnedCards[id] = {
        cardRev: change.doc._rev,
        progressRev: progress && progress._rev ? progress._rev : null,
      };
      const changeDoc: CardChange = progress
        ? mergeRecords(<CardRecord>change.doc, progress)
        : parseCard(<CardRecord>change.doc);
      emit('card', { ...change, id, doc: changeDoc });
    } else if (change.doc._id.startsWith(PROGRESS_PREFIX)) {
      // If the progress has been deleted, we'll report the deletion when
      // the corresponding card is dropped.
      if (change.doc._deleted) {
        return;
      }
      const id = stripProgressPrefix(change.doc._id);
      let card;
      try {
        card = await this.db.get<CardRecord>(CARD_PREFIX + id);
      } catch (e) {
        // If the card was deleted, just ignore. We'll report when we get
        // the corresponding change for the card.
        if (e.status === 404 && e.reason === 'deleted') {
          return;
        }
        throw e;
      }
      if (alreadyReturnedCard(<ProgressRecord>change.doc)) {
        return undefined;
      }
      this.returnedCards[id] = {
        cardRev: card._rev,
        progressRev: change.doc._rev,
      };
      emit('card', {
        ...change,
        id,
        doc: mergeRecords(card, <ProgressRecord>change.doc),
      });
    }

    return undefined;
  }

  // Maintenance functions

  async getOrphanedCards() {
    // I couldn't find any neat way of doing this in a reduce function so
    // I guess we just need to fetch all card records and iterate them.
    // Fortunately we never use this in production code.
    const cards = await this.db.allDocs({
      include_docs: true,
      startkey: CARD_PREFIX,
      endkey: CARD_PREFIX + '\ufff0',
    });

    const orphans = [];

    for (const card of cards.rows) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await this.db.get(PROGRESS_PREFIX + stripCardPrefix(card.id));
      } catch (e) {
        orphans.push(card.doc);
      }
    }

    return orphans;
  }

  async addProgressRecordForCard(cardId: string) {
    const progressToPut = {
      _id: PROGRESS_PREFIX + stripCardPrefix(cardId),
      reviewed: null,
      level: 0,
    };
    try {
      await this.db.put(progressToPut);
    } catch (err) {
      console.error(`Unexpected error putting progress record: ${err}`);
      throw err;
    }
  }

  async getOrphanedProgress() {
    const records = await this.db.allDocs({
      include_docs: true,
      startkey: PROGRESS_PREFIX,
      endkey: PROGRESS_PREFIX + '\ufff0',
    });

    const orphans = [];

    for (const progress of records.rows) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await this.db.get(CARD_PREFIX + stripProgressPrefix(progress.id));
      } catch (e) {
        orphans.push(progress.doc);
      }
    }

    return orphans;
  }

  async deleteProgressRecord(progressId: string) {
    let doc;
    try {
      doc = await this.db.get(progressId);
    } catch (err) {
      console.error(`Unexpected error getting progress record: ${err}`);
      return;
    }

    try {
      await this.db.remove(doc);
    } catch (err) {
      console.error(`Unexpected error deleting progress record: ${err}`);
    }
  }

  // Intended for unit testing only

  async hasProgressRecord(id: string) {
    try {
      await this.db.get(PROGRESS_PREFIX + id);
      return true;
    } catch (err) {
      return false;
    }
  }
}

export default CardStore;
