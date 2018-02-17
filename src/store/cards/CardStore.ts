import * as views from './views';

import { Card, Progress } from '../../model';
import { CARD_PREFIX, PROGRESS_PREFIX } from './records';
import { CardRecord, ProgressRecord } from './records';
import { Omit, MakeOptional } from '../../utils/type-helpers';
import { stubbornDelete } from '../utils';

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

type CardChange = MakeOptional<Card, 'progress'> & PouchDB.Core.ChangesMeta;

type EmitFunction = (type: string, ...args: any[]) => void;

let prevTimeStamp = 0;

interface CardStoreOptions {
  prefetchViews?: boolean;
}

export class CardStore {
  db: PouchDB.Database;
  createdViews: Promise<void>;
  resolveCreatedViews: (() => void) | null;
  prefetchViews: boolean;
  returnedCards: {
    [id: string]: { cardRev: string; progressRev: string | null };
  };

  constructor(db: PouchDB.Database, options?: CardStoreOptions) {
    this.db = db;
    this.returnedCards = {};
    this.prefetchViews = <boolean>(options && options.prefetchViews);
    this.createdViews = new Promise(resolve => {
      this.resolveCreatedViews = resolve;
    });
  }

  async getCards(options: GetCardsOptions): Promise<Card[]> {
    await this.createdViews;

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

    const result = await this.db.query<CardRecord>(view, queryOptions);
    return result.rows.filter(row => row.doc).map(row => ({
      ...parseCard(row.doc!),
      progress: parseProgress(row.value.progress),
    }));
  }

  async getCardsById(ids: string[]): Promise<Card[]> {
    await this.createdViews;

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
    await this.createdViews;

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

  async putCard(card: Partial<Card>): Promise<Card> {
    // New card
    if (!card._id) {
      return this._putNewCard(card);
    }

    const cardUpdate = { ...card };
    delete cardUpdate.progress;
    delete cardUpdate._id;
    const cardRecord = await this._updateCard(card._id, cardUpdate);

    const progressUpdate = { ...card.progress };
    const progressRecord = await this._updateProgress(card._id, progressUpdate);

    return mergeRecords(cardRecord, progressRecord);
  }

  async _putNewCard(card: Partial<Card>): Promise<Card> {
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
        return tryPutNewCard(card, progress, db, CardStore.generateCardId());
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
      CardStore.generateCardId()
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

  static generateCardId() {
    // Start off with the number of milliseconds since 1 Jan 2016.
    let timestamp = Date.now() - Date.UTC(2016, 0, 1);

    // We need to make sure we don't overlap with previous records however.
    // If we do, we just keep incrementing the timestamp---that might mean the
    // sorting results are slightly off if, for example, we do a bulk import of
    // 10,000 cards while simultaneously adding cards on another device, but
    // it's good enough.
    if (timestamp <= prevTimeStamp) {
      timestamp = ++prevTimeStamp;
    }
    prevTimeStamp = timestamp;

    const id =
      // We take the timestamp, converted to base 36, and zero-pad it so it
      // collates correctly for at least 50 years...
      `0${timestamp.toString(36)}`.slice(-8) +
      // ...then add a random 3-digit sequence to the end in case we
      // simultaneously add a card on another device at precisely the same
      // millisecond.
      `00${Math.floor(Math.random() * 46656).toString(36)}`.slice(-3);
    return id;
  }

  async updateViews(reviewTime: Date) {
    await this.updateCardsView();
    await this.updateNewCardsView();
    await this.updateOverduenessView(reviewTime);

    // If this is the first time we created the views, resolve anyone who was
    // blocked on them.
    if (this.resolveCreatedViews) {
      const resolve = this.resolveCreatedViews;
      this.resolveCreatedViews = null;
      resolve();
    }
  }

  async updateCardsView() {
    return this._updateMapView('cards', views.cardMapFunction);
  }

  async updateNewCardsView() {
    return this._updateMapView('new_cards', views.newCardMapFunction);
  }

  async _updateMapView(view: string, mapFunction: string) {
    return this.db
      .upsert(
        `_design/${view}`,
        (currentDoc: PouchDB.Core.PostDocument<any>) => {
          const doc = {
            _id: `_design/${view}`,
            views: {
              [view]: {
                map: mapFunction,
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
