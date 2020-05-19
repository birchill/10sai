import * as views from './views';
import { Card, CardPlaceholder, Progress } from '../model';
import {
  DeepPartial,
  MakeOptional,
  Omit,
  stripFields,
} from '../utils/type-helpers';
import { generateUniqueTimestampId, updateView, stubbornDelete } from './utils';
import { NOTE_PREFIX } from './NoteStore';

export interface CardContent {
  front: string;
  back: string;
  keywords?: string[];
  tags?: string[];
  starred?: boolean;
  created: number;
  modified: number;
}

export interface ProgressContent {
  level: number;
  due: number;
}

export type CardDoc = PouchDB.Core.Document<CardContent>;
type ExistingCardDoc = PouchDB.Core.ExistingDocument<CardContent>;
type ExistingCardDocWithChanges = PouchDB.Core.ExistingDocument<
  CardContent & PouchDB.Core.ChangesMeta
>;

type ProgressDoc = PouchDB.Core.Document<ProgressContent>;
type ExistingProgressDoc = PouchDB.Core.ExistingDocument<ProgressContent>;
type ExistingProgressDocWithChanges = PouchDB.Core.ExistingDocument<
  ProgressContent & PouchDB.Core.ChangesMeta
>;

export type CardChange =
  | { card: Card; deleted?: false }
  | {
      card: MakeOptional<Card, 'progress'>;
      deleted: true;
    };

export const CARD_PREFIX = 'card-';
export const PROGRESS_PREFIX = 'progress-';

const stripCardPrefix = (id: string) => id.substr(CARD_PREFIX.length);
const stripProgressPrefix = (id: string) => id.substr(PROGRESS_PREFIX.length);

// Take a card from the DB and turn it into a more appropriate form for
// client consumption
const parseCard = (
  card: ExistingCardDoc | CardDoc
): Omit<Card, 'progress'> => ({
  ...stripFields(card as ExistingCardDoc, ['_id', '_rev']),
  front: card.front || '',
  back: card.back || '',
  id: stripCardPrefix(card._id),
  keywords: card.keywords || [],
  tags: card.tags || [],
  starred: !!card.starred,
  // We deliberately *don't* parse the 'created' or 'modified' fields into
  // Date objects since they're currently not used in the app and so
  // speculatively parsing them would be a waste.
});

const parseProgress = (
  progress: ProgressDoc | ExistingProgressDoc
): Progress => ({
  ...stripFields(progress as ExistingProgressDoc, ['_id', '_rev']),
  due: progress.due ? new Date(progress.due) : null,
});

const mergeDocs = (
  card: CardDoc | ExistingCardDoc,
  progress: ProgressDoc | ExistingProgressDoc
): Card => {
  const result = {
    ...parseCard(card),
    progress: parseProgress(progress),
  };

  return result;
};

const overdueOrNewCardSelector = (reviewTime: Date): PouchDB.Find.Selector => ({
  _id: { $gt: 'progress-', $lt: 'progress-\ufff0' },
  due: { $lte: reviewTime.getTime() },
});

const isCardChangeDoc = (
  changeDoc:
    | PouchDB.Core.ExistingDocument<any & PouchDB.Core.ChangesMeta>
    | undefined
): changeDoc is ExistingCardDocWithChanges => {
  return changeDoc && changeDoc._id.startsWith(CARD_PREFIX);
};

const isProgressChangeDoc = (
  changeDoc:
    | PouchDB.Core.ExistingDocument<any & PouchDB.Core.ChangesMeta>
    | undefined
): changeDoc is ExistingProgressDocWithChanges => {
  return changeDoc && changeDoc._id.startsWith(PROGRESS_PREFIX);
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

interface CardStoreOptions {
  prefetchViews?: boolean;
}

type EmitFunction = (type: string, ...args: any[]) => void;

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
      const promise = new Promise<void>((resolveFn) => {
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

  async destroy() {
    // Wait for the due index to finish being created or else tests will fail
    return this.viewPromises.review.promise;
  }

  async getCards() {
    await this.viewPromises.cards.promise;

    const queryOptions: PouchDB.Query.Options<any, any> = {
      include_docs: true,
      descending: true,
    };

    const result = await this.db.query<CardContent>('cards', queryOptions);
    return result.rows
      .filter((row) => row.doc)
      .map((row) => ({
        ...parseCard(row.doc!),
        progress: parseProgress(row.value.progress),
      }));
  }

  async getCardsById(ids: string[]): Promise<Array<Card | CardPlaceholder>> {
    const progressResult = await this.db.allDocs<ProgressContent>({
      keys: ids.map((id) => PROGRESS_PREFIX + id),
      include_docs: true,
    });
    const cardsResult = await this.db.allDocs<CardContent>({
      keys: ids.map((id) => CARD_PREFIX + id),
      include_docs: true,
    });

    if (progressResult.rows.length !== cardsResult.rows.length) {
      throw new Error(
        `Got mismatched number of card records (progress: ${progressResult.rows.length} vs cards: ${cardsResult.rows.length})`
      );
    }

    const result: Array<Card | CardPlaceholder> = [];
    for (const [i, progressRow] of progressResult.rows.entries()) {
      if (
        !progressRow.doc ||
        (progressRow as any).error ||
        progressRow.value.deleted
      ) {
        const placeholder: CardPlaceholder = {
          id: ids[i],
          status: progressRow.value?.deleted ? 'deleted' : 'missing',
        };
        result.push(placeholder);
        continue;
      }

      const cardRow = cardsResult.rows[i];
      if (!cardRow.doc || (cardRow as any).error || cardRow.value.deleted) {
        const placeholder: CardPlaceholder = {
          id: ids[i],
          status: cardRow.value?.deleted ? 'deleted' : 'missing',
        };
        result.push(placeholder);
        continue;
      }

      result.push({
        ...parseCard(cardRow.doc),
        progress: parseProgress(progressRow.doc),
      });
    }

    return result;
  }

  async getAvailableCards({
    reviewTime,
  }: {
    reviewTime: Date;
  }): Promise<Array<[string, Progress]>> {
    await this.viewPromises.review.promise;

    const findResult = (await this.db.find({
      selector: overdueOrNewCardSelector(reviewTime),
      use_index: ['progress_by_due_date', 'due'],
    })) as PouchDB.Find.FindResponse<ProgressContent>;

    const result: Array<[string, Progress]> = findResult.docs.map((doc) => [
      stripProgressPrefix(doc._id),
      parseProgress(doc),
    ]);
    return result;
  }

  async putCard(card: Partial<Card>): Promise<Card> {
    if (!card.id) {
      return this._putNewCard(card);
    }

    const cardUpdate = stripFields(card, ['id', 'progress']);
    const cardDoc = await this._updateCard(card.id, cardUpdate);

    const progressUpdate = { ...card.progress };
    const progressDoc = await this._updateProgress(card.id, progressUpdate);

    return mergeDocs(cardDoc, progressDoc);
  }

  async _putNewCard(card: DeepPartial<Card>): Promise<Card> {
    const now = new Date().getTime();
    let cardContent: CardContent = {
      ...stripFields(card, ['id', 'progress']),
      // Fill-in mandatory fields
      front: card.front || '',
      back: card.back || '',
      // Update dates
      created: now,
      modified: now,
    };
    cardContent = normalizeCardForDB(cardContent, cardContent);

    const progressContent: ProgressContent = {
      level:
        card.progress && typeof card.progress.level !== 'undefined'
          ? card.progress.level
          : 0,
      due:
        card.progress && card.progress.due instanceof Date
          ? card.progress.due.getTime()
          : 0,
    };

    return (async function tryPutNewCard(
      card: CardContent,
      progress: Partial<ProgressContent>,
      db,
      id
    ): Promise<Card> {
      let putCardResponse;
      try {
        putCardResponse = await db.put<CardContent>({
          ...card,
          _id: CARD_PREFIX + id,
        });
      } catch (err) {
        if (err.status !== 409) {
          throw err;
        }
        // If we put the card and there was a conflict, it must mean we
        // chose an overlapping ID. Just keep trying until it succeeds.
        return tryPutNewCard(card, progress, db, generateUniqueTimestampId());
      }

      const newCard: ExistingCardDoc = {
        ...card,
        _id: CARD_PREFIX + id,
        _rev: putCardResponse.rev,
      };

      // Succeeded in putting the card. Now to add a corresponding progress
      // document. We have a unique card ID so there can't be any overlapping
      // progress document unless something is very wrong.
      const progressToPut = {
        due: 0,
        level: 0,
        ...progress,
        _id: PROGRESS_PREFIX + id,
      };
      try {
        await db.put<ProgressContent>(progressToPut);
      } catch (err) {
        console.error(`Unexpected error putting progress document: ${err}`);
        await db.remove({ _id: CARD_PREFIX + id, _rev: putCardResponse.rev });
        throw err;
      }

      return mergeDocs(newCard, progressToPut);
    })(cardContent, progressContent, this.db, generateUniqueTimestampId());
  }

  async _updateCard(
    id: string,
    update: Partial<Omit<Card, 'progress'>>
  ): Promise<CardDoc> {
    let card: CardDoc | undefined;
    let missing = false;

    await this.db.upsert<CardContent>(CARD_PREFIX + id, (doc) => {
      // Doc was not found -- must have been deleted
      if (!doc.hasOwnProperty('_id')) {
        missing = true;
        return false;
      }

      // If we ever end up speculatively parsing date fields into Date objects
      // in parseCard, then we'll need special handling here to make sure we
      // write and return the correct formats.
      card = {
        ...(doc as CardDoc),
        ...update,
        _id: CARD_PREFIX + id,
      };

      if (!Object.keys(update).length) {
        return false;
      }

      card = normalizeCardForDB(card, update);
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
  ): Promise<ProgressDoc> {
    let progress: ProgressDoc | undefined;
    let missing = false;

    await this.db.upsert<ProgressContent>(PROGRESS_PREFIX + id, (doc) => {
      // Doc was not found -- must have been deleted
      if (!doc.hasOwnProperty('_id')) {
        missing = true;
        return false;
      }

      progress = doc as ProgressDoc;

      let hasChange = false;

      if (
        update &&
        typeof update.due !== 'undefined' &&
        ((update.due instanceof Date &&
          progress.due !== update.due.getTime()) ||
          (update.due === null && progress.due !== 0))
      ) {
        progress.due = update.due === null ? 0 : update.due.getTime();
        hasChange = true;
      }

      if (
        update &&
        typeof update.level === 'number' &&
        progress.level !== update.level
      ) {
        progress.level = update.level;
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
    const card = await this.db.get<CardContent>(CARD_PREFIX + id);
    const progress = await this.db.get<ProgressContent>(PROGRESS_PREFIX + id);
    return mergeDocs(card, progress);
  }

  async deleteCard(id: string) {
    await stubbornDelete(CARD_PREFIX + id, this.db);
    await stubbornDelete(PROGRESS_PREFIX + id, this.db);
  }

  async getKeywords(prefix: string, limit: number): Promise<string[]> {
    await this.viewPromises.keywords.promise;

    return this.getKeywordsOrTags('keywords', prefix.normalize(), limit);
  }

  async getTags(prefix: string, limit: number): Promise<string[]> {
    await this.viewPromises.tags.promise;

    return this.getKeywordsOrTags('tags', prefix.normalize(), limit);
  }

  async getKeywordsOrTags(
    view: string,
    prefix: string,
    limit: number
  ): Promise<string[]> {
    // We fetch a lot more documents than requested since we want to return the
    // highest frequency documents, not just the first |limit| keywords/tags
    // that match.
    //
    // For the prefix === '' case we should ideally look at *all* the
    // keywords/tags but I couldn't find an easy and efficient way to sort the
    // keywords/tags view by frequency AND by key so we can do the substring
    // lookup short of making two views so we just take the first 200
    // keywords/tags and return the highest frequency ones amongst them. If the
    // user has more than 200 unique keywords/tags then (a) they can probably
    // cope with not having the absolute optimal initial suggestions, and (b)
    // they're probably doing it wrong anyway.
    const minDocs = prefix === '' ? 200 : 40;

    const queryOptions: PouchDB.Query.Options<any, any> = {
      limit: Math.max(minDocs, limit),
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
      .map((entry) => entry.key[1])
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

      // Sort by case-insensitive complete matches next
      const lcValueA = valueA.toLowerCase();
      const lcValueB = valueB.toLowerCase();
      if (lcValueA !== lcValueB) {
        const lcPrefix = prefix.toLowerCase();
        if (lcValueA === lcPrefix) {
          return -1;
        }
        if (lcValueB === lcPrefix) {
          return 1;
        }
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

  async updateViews() {
    this.updateCardsView().then(() => {
      if (!this.viewPromises.cards.resolved) {
        this.viewPromises.cards.resolved = true;
        this.viewPromises.cards.resolve();
      }
    });

    this.db
      .createIndex({
        index: {
          fields: ['due'],
          name: 'due',
          ddoc: 'progress_by_due_date',
        },
      })
      .then(() => {
        if (!this.viewPromises.review.resolved) {
          this.viewPromises.review.resolved = true;
          this.viewPromises.review.resolve();
        }
      });

    this.updateKeywordsView().then(() => {
      if (!this.viewPromises.keywords.resolved) {
        this.viewPromises.keywords.resolved = true;
        this.viewPromises.keywords.resolve();
      }
    });

    this.updateTagsView().then(() => {
      if (!this.viewPromises.tags.resolved) {
        this.viewPromises.tags.resolved = true;
        this.viewPromises.tags.resolve();
      }
    });
  }

  async updateCardsView() {
    return updateView({
      db: this.db,
      view: 'cards',
      mapFunction: views.cardMapFunction(CARD_PREFIX, PROGRESS_PREFIX),
      prefetch: this.prefetchViews,
    });
  }

  async updateKeywordsView() {
    return updateView({
      db: this.db,
      view: 'keywords',
      mapFunction: views.keywordMapFunction(CARD_PREFIX, NOTE_PREFIX),
      reduce: '_sum',
      prefetch: this.prefetchViews,
    });
  }

  async updateTagsView() {
    return updateView({
      db: this.db,
      view: 'tags',
      mapFunction: views.tagMapFunction(CARD_PREFIX),
      reduce: '_sum',
      prefetch: this.prefetchViews,
    });
  }

  async onChange(
    change: PouchDB.Core.ChangesResponseChange<{}>,
    emit: EmitFunction
  ) {
    if (!change.doc) {
      return;
    }

    // When a new card is added we'll get a change callback for both the card
    // document and the progress document but, since we lookup the other half
    // before calling the callback, we'd end up calling the callback with the
    // same document twice. Likewise for any change that touches both documents
    // at once.
    //
    // That's wasteful particularly if we are doing a big sync -- we'll end up
    // calling the callback twice as many times as we need to. Furthermore it's
    // exposing an implementation detail of this class that we should really
    // hide.
    //
    // To mediate that, we maintain a map of all the card/progress revisions we
    // have returned so we can avoid returning the same thing twice.
    const alreadyReturnedCard = (
      doc: ExistingCardDoc | ExistingProgressDoc
    ) => {
      if (doc._id.startsWith(CARD_PREFIX)) {
        const id = stripCardPrefix(doc._id);
        return (
          this.returnedCards[id] && this.returnedCards[id].cardRev === doc._rev
        );
      } else if (doc._id.startsWith(PROGRESS_PREFIX)) {
        const id = stripProgressPrefix(doc._id);
        return (
          this.returnedCards[id] &&
          this.returnedCards[id].progressRev === doc._rev
        );
      }
      return false;
    };

    if (isCardChangeDoc(change.doc)) {
      const id = stripCardPrefix(change.doc._id);
      let progress;
      if (!change.doc._deleted) {
        try {
          progress = await this.db.get<ProgressContent>(PROGRESS_PREFIX + id);
        } catch (e) {
          if (e.status === 404) {
            // If we can't find the progress document there are two
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
      // fetching the progress document, it might be reported here.
      if (alreadyReturnedCard(change.doc)) {
        return undefined;
      }
      this.returnedCards[id] = {
        cardRev: change.doc._rev,
        progressRev: progress && progress._rev ? progress._rev : null,
      };
      let result: CardChange;
      if (change.deleted || !progress) {
        result = { card: parseCard(change.doc), deleted: true };
      } else {
        result = { card: mergeDocs(change.doc, progress) };
      }
      emit('card', result);
    } else if (isProgressChangeDoc(change.doc)) {
      // If the progress has been deleted, we'll report the deletion when
      // the corresponding card is dropped.
      if (change.doc._deleted) {
        return;
      }
      const id = stripProgressPrefix(change.doc._id);
      let card;
      try {
        card = await this.db.get<CardContent>(CARD_PREFIX + id);
      } catch (e) {
        // If the card was deleted, just ignore. We'll report when we get
        // the corresponding change for the card.
        if (e.status === 404 && e.reason === 'deleted') {
          return;
        }
        throw e;
      }
      if (alreadyReturnedCard(change.doc)) {
        return undefined;
      }
      this.returnedCards[id] = {
        cardRev: card._rev,
        progressRev: change.doc._rev,
      };
      emit('card', { card: mergeDocs(card, change.doc) });
    }

    return undefined;
  }

  async onSyncChange(
    doc: PouchDB.Core.ExistingDocument<{} & PouchDB.Core.ChangesMeta>
  ) {
    if (!isCardChangeDoc(doc) && !isProgressChangeDoc(doc)) {
      return;
    }

    if (doc._deleted) {
      return;
    }

    // Check for conflicts to resolve.
    const result = await this.db.get<ProgressContent | CardContent>(doc._id, {
      conflicts: true,
    });
    if (!result._conflicts) {
      return;
    }

    if (isCardChangeDoc(doc)) {
      await this.db.resolveConflicts<CardContent>(
        result as CardDoc & PouchDB.Core.GetMeta,
        (a, b) => {
          return a.modified >= b.modified ? a : b;
        }
      );
    } else {
      await this.db.resolveConflicts(
        result as ProgressDoc & PouchDB.Core.GetMeta,
        (a, b) => {
          const roughReviewTime = (doc: ProgressContent): number => {
            return doc.due - doc.level * MS_PER_DAY;
          };

          return roughReviewTime(a) >= roughReviewTime(b) ? a : b;
        }
      );
    }
  }

  // Maintenance functions

  async getOrphanedCards() {
    // I couldn't find any neat way of doing this in a reduce function so
    // I guess we just need to fetch all card documents and iterate them.
    // Fortunately we never use this in production code.
    const cards = await this.db.allDocs({
      include_docs: true,
      startkey: CARD_PREFIX,
      endkey: CARD_PREFIX + '\ufff0',
    });

    const orphans = [];

    for (const card of cards.rows) {
      try {
        await this.db.get(PROGRESS_PREFIX + stripCardPrefix(card.id));
      } catch (e) {
        orphans.push(card.doc);
      }
    }

    return orphans;
  }

  async addProgressDocumentForCard(cardId: string) {
    const progressToPut = {
      _id: PROGRESS_PREFIX + stripCardPrefix(cardId),
      due: 0,
      level: 0,
    };
    try {
      await this.db.put(progressToPut);
    } catch (err) {
      console.error(`Unexpected error putting progress document: ${err}`);
      throw err;
    }
  }

  async getOrphanedProgress() {
    const docs = await this.db.allDocs({
      include_docs: true,
      startkey: PROGRESS_PREFIX,
      endkey: PROGRESS_PREFIX + '\ufff0',
    });

    const orphans = [];

    for (const progress of docs.rows) {
      try {
        await this.db.get(CARD_PREFIX + stripProgressPrefix(progress.id));
      } catch (e) {
        orphans.push(progress.doc);
      }
    }

    return orphans;
  }

  async deleteProgressDocument(progressId: string) {
    let doc;
    try {
      doc = await this.db.get(progressId);
    } catch (err) {
      console.error(`Unexpected error getting progress document: ${err}`);
      return;
    }

    try {
      await this.db.remove(doc);
    } catch (err) {
      console.error(`Unexpected error deleting progress document: ${err}`);
    }
  }

  // Intended for unit testing only

  async hasProgressDocument(id: string) {
    try {
      await this.db.get(PROGRESS_PREFIX + id);
      return true;
    } catch (err) {
      return false;
    }
  }
}

function normalizeCardForDB<T extends CardContent | CardDoc>(
  cardContent: T,
  update: CardContent | Partial<Card>
): T {
  const normalized = {
    ...cardContent,
    front: cardContent.front.normalize(),
    back: cardContent.back.normalize(),
  };

  if (update.keywords && !update.keywords.length) {
    delete normalized.keywords;
  }
  if (normalized.keywords) {
    normalized.keywords = normalized.keywords.map((keyword) =>
      keyword.normalize()
    );
  }

  if (update.tags && !update.tags.length) {
    delete normalized.tags;
  }
  if (normalized.tags) {
    normalized.tags = normalized.tags.map((tag) => tag.normalize());
  }

  if (typeof update.starred !== 'undefined' && !update.starred) {
    delete normalized.starred;
  }

  return normalized;
}
