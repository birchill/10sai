import { Note } from '../../model';
import { NOTE_PREFIX, NoteRecord } from './records';
import { generateUniqueTimestampId, stubbornDelete } from '../utils';
import { Omit, stripFields } from '../../utils/type-helpers';

const parseNote = (note: NoteRecord): Note => {
  const result: Note = {
    ...stripFields(note, ['_id', '_rev']),
    id: note._id.substr(NOTE_PREFIX.length),
    keywords: note.keywords || [],
  };

  return result;
};

type EmitFunction = (type: string, ...args: any[]) => void;

class NoteStore {
  db: PouchDB.Database;

  constructor(db: PouchDB.Database) {
    this.db = db;
  }

  async getNote(id: string): Promise<Note> {
    return parseNote(await this.db.get<NoteRecord>(NOTE_PREFIX + id));
  }

  async putNote(note: Partial<Note>): Promise<Note> {
    let noteRecord: NoteRecord | undefined;
    let missing = false;
    const now = new Date().getTime();

    if (!note.id) {
      const noteToPut: Omit<NoteRecord, '_rev'> = {
        ...(<Omit<Partial<Note>, 'id'>>note),
        // Fill-in mandatory fields
        _id: NOTE_PREFIX + generateUniqueTimestampId(),
        content: note.content || '',
        created: now,
        modified: now,
      };

      // Drop empty optional fields
      if (noteToPut.keywords && !noteToPut.keywords.length) {
        delete noteToPut.keywords;
      }

      noteRecord = await (async function tryToPutNewNote(
        noteRecord,
        db
      ): Promise<NoteRecord> {
        let result;
        try {
          result = await db.put(noteRecord);
        } catch (err) {
          if (err.status !== 409) {
            throw err;
          }
          noteRecord._id = NOTE_PREFIX + generateUniqueTimestampId();
          return tryToPutNewNote(noteRecord, db);
        }

        return {
          ...noteToPut,
          _rev: result.rev,
        };
      })(<Omit<NoteRecord, '_rev'>>noteToPut, this.db);
    } else {
      const noteUpdate: Partial<NoteRecord> = {
        ...stripFields(note, ['id', 'created']),
        modified: now,
      };

      await this.db.upsert<NoteRecord>(NOTE_PREFIX + note.id, doc => {
        // Doc was not found -- must have been deleted
        if (!doc.hasOwnProperty('_id')) {
          missing = true;
          return false;
        }

        noteRecord = {
          ...(doc as NoteRecord),
          ...noteUpdate,
        };

        // We need to do this after filling-in noteRecord.
        if (Object.keys(noteUpdate).length < 2) {
          return false;
        }
        // XXX Check for redundant changes.

        // Drop empty optional fields.
        if (noteRecord.keywords && !noteRecord.keywords.length) {
          delete noteRecord.keywords;
        }

        return noteRecord;
      });
    }

    if (missing || !noteRecord) {
      const err: Error & { status?: number } = new Error('missing');
      err.status = 404;
      err.name = 'not_found';
      throw err;
    }

    return parseNote(noteRecord);
  }

  async deleteNote(id: string) {
    await stubbornDelete(NOTE_PREFIX + id, this.db);
  }

  async onChange(
    change: PouchDB.Core.ChangesResponseChange<{}>,
    emit: EmitFunction
  ) {
    if (!change.doc || !change.doc._id.startsWith(NOTE_PREFIX)) {
      return;
    }

    // XXX Parse the full thing then call
    // emit('note', parseNote(note));
  }

  async onSyncChange(
    doc: PouchDB.Core.ExistingDocument<NoteRecord & PouchDB.Core.ChangesMeta>
  ) {
    if (doc._deleted) {
      return;
    }

    const result = await this.db.get<NoteRecord>(doc._id, {
      conflicts: true,
    });
    if (!result._conflicts) {
      return;
    }

    await this.db.resolveConflicts(result, (a, b) => {
      if (a.created > b.created) {
        return a;
      }

      return a.modified >= b.created ? a : b;
    });
  }
}

export default NoteStore;
