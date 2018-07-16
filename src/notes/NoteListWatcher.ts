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
  _notes: Note[];
  _keywords: string[];
  listener: NoteListListener;
  initDone: Promise<void>;

  constructor(
    dataStore: DataStore,
    onUpdate: NoteListListener,
    keywords: string[] = []
  ) {
    this.dataStore = dataStore;

    this._notes = [];
    this.listener = onUpdate;

    this.updateKeywords(keywords);

    this.dataStore.changes.on('note', (change: EventType) => {
      const [found, index] = findNote(change.id, this._notes);
      let changedNotes = false;

      const matchesKeywords = () =>
        change.keywords
          .map(keyword => keyword.toLowerCase())
          .some(keyword => this._keywords.includes(keyword));

      if (found) {
        // The changed note was one of our notes, but should it still be?
        if (change._deleted || !matchesKeywords()) {
          this._notes.splice(index, 1);
        } else {
          // The changed note is on of our notes (and still is). Did something
          // change that we might care about?
          // Assume something this.
          if (!deepEqual(this._notes[index], change)) {
            this._notes[index] = change;
          }
        }
      } else if (!change._deleted && matchesKeywords()) {
        // The changed note wasn't found in our notes, but it should be there.
        this._notes.splice(index, 0, change);
        changedNotes = true;
      }

      if (changedNotes) {
        // Update object identity to make it easier on call sites to do
        // simple object-identity comparisons.
        this._notes = this._notes.slice();
        this.listener(this._notes);
      }
    });
  }

  get notes(): Promise<Note[]> {
    return this.initDone.then(() => this._notes);
  }

  get keywords(): string[] {
    return this._keywords;
  }

  set keywords(keywords: string[]) {
    this.updateKeywords(keywords);
  }

  updateKeywords(keywords: string[]) {
    this._keywords = keywords;

    this.initDone = this._keywords.length
      ? this.dataStore.getNotesForKeywords(keywords).then(notes => {
          // Check that the keywords have not been updated while we were
          // fetching notes.
          if (this._keywords !== keywords) {
            return;
          }

          if (!deepEqual(this.notes, notes)) {
            this._notes = notes;
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

    if (result > 0) {
      min = guess + 1;
    } else {
      max = guess - 1;
    }
  }

  return [false, Math.max(min, max)];
};

export default NoteListWatcher;
