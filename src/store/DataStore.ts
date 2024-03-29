import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import EventEmitter from 'event-emitter';

import { Card, CardPlaceholder, Note, Progress, ReviewSummary } from '../model';
import { DatabaseWithName } from './utils';
import { CardStore, CARD_PREFIX, PROGRESS_PREFIX } from './CardStore';
import { NoteStore, NOTE_PREFIX } from './NoteStore';
import { ReviewStore, REVIEW_ID } from './ReviewStore';
import { Settings, SettingsStore, SETTING_PREFIX } from './SettingsStore';

PouchDB.plugin(require('pouchdb-upsert'));
PouchDB.plugin(PouchDBFind);
PouchDB.plugin(require('pouch-resolve-conflicts'));

// The way the typings for PouchDB-adapter-idb are set up, if you want to
// specify 'storage' you also must specify adapter: 'pouchdb' but we don't want
// that--we want to let Pouch decide the adapter and, if it happens to be IDB,
// use persistent storage.
interface ExtendedDatabaseConfiguration
  extends PouchDB.Configuration.LocalDatabaseConfiguration {
  storage?: 'persistent' | 'temporary';
}

interface StoreOptions {
  pouch?: ExtendedDatabaseConfiguration;
  prefetchViews?: boolean;
}

interface SyncOptions {
  onProgress?: (progress: number | null) => void;
  onIdle?: (err: PouchDB.Core.Error) => void;
  onActive?: () => void;
  onError?: (err: PouchDB.Core.Error) => void;
  username?: string;
  password?: string;
  batchSize?: number;
}

// This interface should be compatible with PouchDB.Core.Error for all our
// purposes so we can use the same type for handling errors returned by getCard
// etc.
export interface StoreError {
  status?: number;
  name: string;
  message: string;
  reason?: string;
  error?: string | boolean;
}

export class StoreError extends Error {
  constructor(status: number, error: string, reason: string) {
    super(reason);
    this.status = status;
    this.name = error;
    this.message = reason;
    this.error = true;
  }
}

const VIEW_CLEANUP_DELAY = 5000; // 5s

export class DataStore {
  db?: PouchDB.Database;
  cardStore: CardStore;
  noteStore: NoteStore;
  reviewStore: ReviewStore;
  settingsStore: SettingsStore;

  initDone: Promise<void>;
  changesEmitter?: EventEmitter.Emitter;
  remoteDb?: PouchDB.Database;
  remoteSync?: PouchDB.Replication.Sync<{}>;
  viewCleanupScheduled: boolean;

  constructor(options?: StoreOptions) {
    const pouchOptions = options && options.pouch ? options.pouch : {};
    if (typeof pouchOptions.auto_compaction === 'undefined') {
      pouchOptions.auto_compaction = true;
    }
    // FIXME: Use the storage API instead
    // pouchOptions.storage = 'persistent';
    this.db = new PouchDB('cards', pouchOptions);

    this.cardStore = new CardStore(this.db, {
      prefetchViews: options && options.prefetchViews,
    });
    this.noteStore = new NoteStore(this.db);
    this.reviewStore = new ReviewStore(this.db);
    this.settingsStore = new SettingsStore(this.db, pouchOptions);

    this.viewCleanupScheduled = false;

    this.initDone = this.db
      .info()
      .then(() => this.cardStore.updateViews())
      .then(() => this.scheduleViewCleanup());
  }

  // Card API
  getCard(id: string): Promise<Card> {
    return this.cardStore.getCard(id);
  }
  deleteCard(id: string) {
    return this.cardStore.deleteCard(id);
  }
  getCards(): Promise<Card[]> {
    return this.cardStore.getCards();
  }
  getCardsById(ids: string[]): Promise<Array<Card | CardPlaceholder>> {
    return this.cardStore.getCardsById(ids);
  }
  getAvailableCards(options: {
    reviewTime: Date;
  }): Promise<Array<[string, Progress]>> {
    return this.cardStore.getAvailableCards(options);
  }
  putCard(card: Partial<Card>): Promise<Card> {
    return this.cardStore.putCard(card);
  }
  getTags(prefix: string, limit: number): Promise<string[]> {
    return this.cardStore.getTags(prefix, limit);
  }
  getKeywords(prefix: string, limit: number): Promise<string[]> {
    return this.cardStore.getKeywords(prefix, limit);
  }

  // Note API
  getNote(id: string): Promise<Note> {
    return this.noteStore.getNote(id);
  }
  putNote(note: Partial<Note>): Promise<Note> {
    return this.noteStore.putNote(note);
  }
  deleteNote(id: string): Promise<void> {
    return this.noteStore.deleteNote(id);
  }
  getNotesForKeywords(keywords: string[]): Promise<Note[]> {
    return this.noteStore.getNotesForKeywords(keywords);
  }

  // Review API
  getReview(): Promise<ReviewSummary | null> {
    return this.reviewStore.getReview();
  }
  putReview(review: ReviewSummary): Promise<void> {
    return this.reviewStore.putReview(review);
  }
  finishReview(): Promise<void> {
    return this.reviewStore.finishReview();
  }

  // Settings API
  settingsDocPrefix = '_local/setting-';
  async getSettings(): Promise<Settings> {
    return this.settingsStore.getSettings();
  }

  async updateSetting(key: string, value: any, destination: 'local' | 'sync') {
    this.settingsStore.updateSetting(key, value, destination);
  }

  async clearSetting(key: string) {
    this.settingsStore.clearSetting(key);
  }

  // Topics include:
  // - card
  // - note
  // - review
  // - setting
  get changes() {
    if (this.changesEmitter) {
      return this.changesEmitter;
    }

    // Once subclassable EventTargets are available in all browsers we should
    // use that instead.
    this.changesEmitter = EventEmitter(null);

    const emit = this.changesEmitter!.emit.bind(this.changesEmitter!);
    this.settingsStore.registerChangeHandler(emit);

    const dbChanges = this.db!.changes({
      since: 'now',
      live: true,
      include_docs: true,
    });

    dbChanges.on('change', async (change) => {
      console.assert(change.changes && change.doc, 'Unexpected changes event');
      await this.cardStore.onChange(change, emit);
      await this.noteStore.onChange(change, emit);
      await this.reviewStore.onChange(change, emit);
      await this.settingsStore.onChange(change, emit);
    });

    return this.changesEmitter;
  }

  // Sets a server for synchronizing with and begins live synchonization.
  //
  // |syncServer| may be any of the following:
  // - A string with the address of a remote server (beginning 'http://' or
  //   'https://')
  // - A PouchDB instance (for unit testing -- we should have have waited on
  //   then() before calling this since PouchDB seems to drop then() after
  //   calling it. Odd.)
  // - Null / undefined / empty string to clear the association with the
  //   existing remote server, if any.
  //
  // |options| is an optional object argument which may provide the following
  // callback functions:
  // - onProgress
  // - onIdle
  // - onActive
  // - onError
  // as well as the |batchSize| member for specifying the number of documents
  // to include in a batch.
  async setSyncServer(
    syncServer?: string | PouchDB.Database | null | undefined,
    options?: SyncOptions
  ) {
    // Setup an alias for error handling
    const reportErrorAsync = (err: Error) => {
      if (options && options.onError) {
        setImmediate(() => {
          options.onError!(err);
        });
      }
    };

    // Validate syncServer argument
    if (typeof syncServer === 'string') {
      syncServer = syncServer.trim();
      if (
        syncServer &&
        !syncServer.startsWith('http://') &&
        !syncServer.startsWith('https://')
      ) {
        const err = new StoreError(
          400,
          'bad_request',
          'Only http and https remote servers are recognized'
        );
        reportErrorAsync(err);
        throw err;
      }
    }

    // We use to wait on this.initDone here but for some reason that would cause
    // tests to fail because we'd assume we were idle before we really were.
    // It's weird. I don't get it. But I also couldn't figure out why we were
    // waiting on initDone in the first place, so, now we don't. Oh well.

    if (this.remoteSync) {
      this.remoteSync.cancel();
      this.remoteSync = undefined;
    }

    this.remoteDb = undefined;

    if (!syncServer) {
      return;
    }

    let dbOptions;
    if (options && options.username) {
      dbOptions = {
        auth: {
          username: options.username,
          password: options.password,
        },
      };
    }
    this.remoteDb =
      typeof syncServer === 'string'
        ? new PouchDB(syncServer, dbOptions)
        : syncServer;

    // Unfortunately the PouchDB typings forgot the 'name' member of Database.
    // FIXME: File a PR for this.
    const originalDbName = (this.remoteDb as DatabaseWithName).name;

    // Initial sync
    let localUpdateSeq: number | undefined;
    let remoteUpdateSeq: number | undefined;
    try {
      const localInfo = await this.db!.info();
      // parseInt will stringify its first argument so it doesn't matter than
      // update_seq can sometimes be a number.
      localUpdateSeq = parseInt(<string>localInfo.update_seq, 10);

      const remoteInfo = await this.remoteDb!.info();
      remoteUpdateSeq = parseInt(<string>remoteInfo.update_seq, 10);
    } catch (err) {
      // Skip error if the remote DB has already been changed.
      // This happens, for example, if we cancel while attempting to connect
      // to a server.
      if (
        !this.remoteDb ||
        originalDbName !== (this.remoteDb as DatabaseWithName).name
      ) {
        return;
      }
      // Convert FetchErrors to something more familiar.
      // This is really only for unit testing.
      if (err.constructor.name === 'FetchError') {
        const message = err.message;
        err = new StoreError(500, err.errno, 'FetchError');
        err.message = message;
      }
      this.remoteDb = undefined;
      reportErrorAsync(err);
      throw err;
    }

    const pushPullOpts =
      options && options.batchSize
        ? { batch_size: options.batchSize }
        : undefined;
    // Don't push design docs since in many cases we'll be authenticating as
    // a user that doesn't have permission to write design docs. Some of the
    // design docs we create are also very temporary.
    const pushOpts = {
      ...pushPullOpts,
      filter: (doc: PouchDB.Core.Document<{}>) => {
        return !doc._id.startsWith('_design/');
      },
    };
    this.remoteSync = this.db!.sync(this.remoteDb!, {
      live: true,
      retry: true,
      pull: pushPullOpts,
      push: pushOpts,
    });

    // Wrap and set callbacks
    const wrapCallback = (evt: string, callback: Function | undefined) => {
      return (...args: any[]) => {
        // Skip events if they are from an old remote DB
        if (
          !this.remoteDb ||
          originalDbName !== (this.remoteDb as DatabaseWithName).name
        ) {
          return;
        }

        // We only report progress for the initial sync
        if (evt === 'paused') {
          localUpdateSeq = undefined;
          remoteUpdateSeq = undefined;
        }

        if (callback) {
          callback.apply(this, args);
        }
      };
    };

    // The change callback is special because we always want to set it
    // so that we can resolve conflicts. It also is where we do the (slightly
    // complicated) progress calculation.
    const changeCallback = (info: PouchDB.Replication.SyncResult<{}>) => {
      // Skip events if they are from an old remote DB
      if (
        !this.remoteDb ||
        originalDbName !== (this.remoteDb as DatabaseWithName).name
      ) {
        return;
      }

      // Resolve any conflicts
      if (info.direction === 'pull') {
        this.onSyncChange(info.change.docs);
      }

      // Call onProgress handlers with the up-to-date progress
      if (options && typeof options.onProgress === 'function') {
        // Calculate progress. Null means 'indeterminate' which is
        // what we report for all but the initial sync.
        let progress = null;
        if (
          typeof localUpdateSeq === 'number' &&
          typeof remoteUpdateSeq === 'number' &&
          info &&
          info.change &&
          info.change.last_seq
        ) {
          const upper = Math.max(localUpdateSeq, remoteUpdateSeq);
          const lower = Math.min(localUpdateSeq, remoteUpdateSeq);
          // This redudant arrangement is my way of saying these PouchDB
          // typings leave a lot to be desired. Looking at the pouch
          // source last_seq can clearly be a string as well and yet the
          // typings insist its a number. Then the parseInt typings fail
          // to recognize that parseInt will stringify its first argument
          // so its fine to pass an number in as well.
          const current = parseInt(
            <string>(info.change.last_seq as string | number),
            10
          );

          // In some cases such as when our initial sync is
          // a bidirectional sync, we can't really produce a reliable
          // progress value. In future we will fix this by using CouchDB
          // 2.0's 'pending' value (once PouchDB exposes it) and possibly
          // do a separate download then upload as part of the initial
          // sync. For now, we just fall back to using an indeterminate
          // progress value if we detect such a case.
          if (current < lower || upper === lower) {
            localUpdateSeq = undefined;
            remoteUpdateSeq = undefined;
          } else {
            progress = (current - lower) / (upper - lower);
          }
        }

        options.onProgress(progress);
      }
    };

    // Always register the change callback.
    this.remoteSync.on('change', changeCallback);

    const callbackMap: {
      [key in 'paused' | 'active' | 'error' | 'denied']: keyof SyncOptions;
    } = {
      paused: 'onIdle',
      active: 'onActive',
      error: 'onError',
      denied: 'onError',
    };
    if (options) {
      for (const [evt, callbackKey] of Object.entries(callbackMap)) {
        // If we have any callbacks at all then we need to listen for 'active'
        // otherwise we won't get the expected number of callbacks it seems.
        if (typeof options[callbackKey] !== 'function' && evt !== 'active') {
          continue;
        }
        this.remoteSync.on(
          <any>evt,
          wrapCallback(evt, <Function>options[callbackKey])
        );
      }
    } else {
      this.remoteSync.on('active', wrapCallback('active', undefined));
    }

    // As far as I can tell, this.remoteSync is a then-able that resolves
    // when the sync finishes. However, since we specified 'live: true'
    // that's not going to happen any time soon, so we need to be careful
    // *not* to wait on this.remoteSync here.
    await this.remoteDb;
  }

  async onSyncChange(docs: PouchDB.Core.ExistingDocument<{}>[]) {
    for (const doc of docs) {
      await this.cardStore.onSyncChange(
        <PouchDB.Core.ExistingDocument<{} & PouchDB.Core.ChangesMeta>>doc
      );
      await this.noteStore.onSyncChange(
        <PouchDB.Core.ExistingDocument<{} & PouchDB.Core.ChangesMeta>>doc
      );
      await this.reviewStore.onSyncChange(
        <PouchDB.Core.ExistingDocument<{} & PouchDB.Core.ChangesMeta>>doc
      );

      // NOTE: resolveConflicts will currently drop attachments on the floor.
      // Need to be careful once we start using them.
    }
  }

  scheduleViewCleanup() {
    if (this.viewCleanupScheduled) {
      return;
    }

    this.viewCleanupScheduled = true;
    setTimeout(() => {
      this.viewCleanupScheduled = false;
      if (this.db) {
        this.db.viewCleanup();
      }
    }, VIEW_CLEANUP_DELAY);
  }

  // Maintenance methods

  async getUnrecognizedDocs() {
    const docs = await this.db!.allDocs({ include_docs: true });

    const unrecognized = [];

    for (const doc of docs.rows) {
      if (
        !doc.id.startsWith('_design') &&
        !doc.id.startsWith(CARD_PREFIX) &&
        !doc.id.startsWith(NOTE_PREFIX) &&
        !doc.id.startsWith(PROGRESS_PREFIX) &&
        doc.id !== REVIEW_ID &&
        !doc.id.startsWith(SETTING_PREFIX)
      ) {
        unrecognized.push(doc.doc);
      }
    }

    return unrecognized;
  }

  async deleteUnrecognizedDocs(ids: string[]) {
    for (const id of ids) {
      if (
        id.startsWith('_design') ||
        id.startsWith(CARD_PREFIX) ||
        id.startsWith(NOTE_PREFIX) ||
        id.startsWith(PROGRESS_PREFIX) ||
        id === REVIEW_ID ||
        id.startsWith(SETTING_PREFIX)
      ) {
        throw new Error('I recognize this doc');
      }
    }

    const result = await this.db!.allDocs({ keys: ids });
    await this.db!.bulkDocs(
      result.rows.map((row) => ({
        _id: row.id,
        _rev: row.value.rev,
        _deleted: true,
      }))
    );
  }

  // Intended for unit testing only

  async destroy(): Promise<void> {
    await this.initDone;
    await this.cardStore.destroy();
    await this.settingsStore.destroy();

    if (!this.db) {
      return;
    }

    const db = this.db;
    this.db = undefined;
    return db.destroy();
  }

  getSyncServer() {
    return this.remoteDb;
  }
}
