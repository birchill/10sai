import { collate } from 'pouchdb-collate';
import { Note } from '../model';
import { DataStore } from '../store/DataStore';
import deepEqual from 'deep-equal';

// A wrapper around a Store that watches for Notes that match a given set of
// keywords.

type NoteListListener = (notes: Note[]) => void;

// XXX We should fix this and invent a proper type for representing changes that
// makes the 'deleted' member separate.
type EventType = Note & { _deleted?: boolean };

export class NoteListWatcher {
  dataStore: DataStore;
  notes: Note[];
  keywords: string[];
  listener: NoteListListener;
  initDone: Promise<void>;

  constructor(
    dataStore: DataStore,
    onUpdate: NoteListListener,
    keywords: string[] = []
  ) {
    this.dataStore = dataStore;

    this.notes = [];
    this.listener = onUpdate;

    const keywordsLowercase = keywords.map(keyword => keyword.toLowerCase());
    this.updateKeywords(keywordsLowercase);

    this.dataStore.changes.on('note', (change: EventType) => {
      const [found, index] = findNote(change.id, this.notes);
      let updatedNotes: Note[] | undefined;

      const matchesKeywords = () =>
        change.keywords.some(keyword =>
          this.keywords.includes(keyword.toLowerCase())
        );

      if (found) {
        // The changed note was one of our notes, but should it still be?
        if (change._deleted || !matchesKeywords()) {
          updatedNotes = this.notes.slice();
          updatedNotes.splice(index, 1);
        } else {
          // The changed note is on of our notes (and still is). Did something
          // change that we might care about?
          // Assume something this.
          if (!deepEqual(this.notes[index], change)) {
            updatedNotes = this.notes.slice();
            updatedNotes[index] = change;
          }
        }
      } else if (!change._deleted && matchesKeywords()) {
        // The changed note wasn't found in our notes, but it should be there.
        updatedNotes = this.notes.slice();
        updatedNotes.splice(index, 0, change);
      }

      if (typeof updatedNotes !== 'undefined') {
        this.notes = updatedNotes;
        this.listener(this.notes);
      }
    });
  }

  getNotes(): Promise<Note[]> {
    return this.initDone.then(() => this.notes);
  }

  // Note that this will be the lowercased version of the keywords.
  getKeywords(): string[] {
    return this.keywords;
  }

  setKeywords(keywords: string[]) {
    // All keyword comparisons are case-insensitive and we store the keywords
    // in lowercase to avoid having to do it every time we get a callback.
    // As a result we should be careful to lowercase the input case before
    // comparing old and new.
    const keywordsLowercase = keywords.map(keyword => keyword.toLowerCase());
    if (deepEqual(keywordsLowercase, this.keywords)) {
      return;
    }

    this.updateKeywords(keywordsLowercase);
  }

  updateKeywords(keywords: string[]) {
    // The input to this method should already have lowercased all the keywords.
    console.assert(
      !keywords.some(keyword => keyword !== keyword.toLowerCase()),
      'Keywords should already be lowercased'
    );
    this.keywords = keywords;

    this.initDone = this.keywords.length
      ? this.dataStore.getNotesForKeywords(keywords).then(notes => {
          // Check that the keywords have not been updated while we were
          // fetching notes.
          if (this.keywords !== keywords) {
            return;
          }

          if (!deepEqual(this.notes, notes)) {
            this.notes = notes;
            this.listener(notes);
          }
        })
      : Promise.resolve();
  }
}

// Perform a binary search in |notes| for note with id |id|.
//
// Returns a pair [found, index]. If |found| is true, |index| is the index of
// matching card in |notes|. If |found| is false, |index| is the index to use
// such that cards.splice(index, 0, card) would keep |notes| sorted.

const findNote = (id: string, notes: Note[]): [boolean, number] => {
  let min = 0;
  let max = notes.length - 1;
  let guess: number;

  while (min <= max) {
    guess = Math.floor((min + max) / 2);

    const result = collate(notes[guess].id, id);

    if (result === 0) {
      return [true, guess];
    }

    if (result < 0) {
      min = guess + 1;
    } else {
      max = guess - 1;
    }
  }

  return [false, Math.max(min, max)];
};

export default NoteListWatcher;
