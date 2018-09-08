import { collate } from 'pouchdb-collate';
import { Note } from '../model';
import { DataStore } from '../store/DataStore';
import { NoteChange } from '../store/NoteStore';
import deepEqual from 'deep-equal';

// A wrapper around a Store that watches for Notes that match a given set of
// keywords.

type NoteListListener = (notes: Array<Note>, deletedIds: Array<string>) => void;

const normalizeKeywords = (keywords: string[]): string[] =>
  keywords
    .map(keyword => keyword.toLowerCase())
    .filter(keyword => keyword.length > 0);

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

    this.updateKeywords(normalizeKeywords(keywords));
    this.handleChange = this.handleChange.bind(this);

    this.dataStore.changes.on('note', this.handleChange);
  }

  disconnect() {
    this.dataStore.changes.off('note', this.handleChange);
  }

  handleChange(change: NoteChange) {
    const [found, index] = findNote(change.note.id, this.notes);
    let updatedNotes: Note[] | undefined;
    let deletedNotes: Array<string> = [];

    const matchesKeywords = () =>
      change.note.keywords.some(keyword =>
        this.keywords.includes(keyword.toLowerCase())
      );

    if (found) {
      // The changed note was one of our notes, but should it still be?
      if (change.deleted || !matchesKeywords()) {
        updatedNotes = this.notes.slice();
        updatedNotes.splice(index, 1);
        if (change.deleted) {
          deletedNotes.push(change.note.id);
        }
      } else {
        // The changed note is on of our notes (and still is). Did something
        // change that we might care about?
        // Assume something this.
        if (!deepEqual(this.notes[index], change.note)) {
          updatedNotes = this.notes.slice();
          updatedNotes[index] = change.note;
        }
      }
    } else if (!change.deleted && matchesKeywords()) {
      // The changed note wasn't found in our notes, but it should be there.
      updatedNotes = this.notes.slice();
      updatedNotes.splice(index, 0, change.note);
    }

    if (typeof updatedNotes !== 'undefined') {
      this.notes = updatedNotes;
      this.listener(this.notes, deletedNotes);
    }
  }

  getNotes(): Promise<Note[]> {
    return this.initDone.then(() => this.notes);
  }

  // Note that this will be the lowercased version of the keywords.
  getKeywords(): string[] {
    return this.keywords;
  }

  setKeywords(keywords: string[]) {
    const normalizedKeywords = normalizeKeywords(keywords);
    if (deepEqual(normalizedKeywords, this.keywords)) {
      return;
    }

    this.updateKeywords(normalizedKeywords);
  }

  updateKeywords(keywords: string[]) {
    console.assert(
      deepEqual(keywords, normalizeKeywords(keywords)),
      'Keywords should already be normalized'
    );
    this.keywords = keywords;

    if (this.keywords.length) {
      this.initDone = this.dataStore
        .getNotesForKeywords(keywords)
        .then(notes => {
          // Check that the keywords have not been updated while we were
          // fetching notes.
          if (this.keywords !== keywords) {
            return;
          }

          if (!deepEqual(this.notes, notes)) {
            this.notes = notes;
            this.listener(notes, []);
          }
        })
        .catch(e => {
          console.error(e);
        });
    } else {
      // If we had notes, but no longer do, we need to update.
      if (this.notes.length) {
        this.notes = [];
        this.listener([], []);
      }
      this.initDone = Promise.resolve();
    }
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