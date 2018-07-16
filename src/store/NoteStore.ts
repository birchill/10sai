import { Note } from '../model';
import * as views from './views';
import { generateUniqueTimestampId, updateView, stubbornDelete } from './utils';
import { Omit, stripFields } from '../utils/type-helpers';
import { collate } from 'pouchdb-collate';

export interface NoteContent {
  keywords?: string[];
  content: string;
  created: number;
  modified: number;
}

type ExistingNoteDoc = PouchDB.Core.ExistingDocument<NoteContent>;
type NoteDoc = PouchDB.Core.Document<NoteContent>;
type ExistingNoteDocWithChanges = PouchDB.Core.ExistingDocument<
  NoteContent & PouchDB.Core.ChangesMeta
>;

export const NOTE_PREFIX = 'note-';

const parseNote = (note: ExistingNoteDoc | NoteDoc): Note => {
  const result: Note = {
    ...stripFields(note as ExistingNoteDoc, ['_id', '_rev']),
    id: note._id.substr(NOTE_PREFIX.length),
    keywords: note.keywords || [],
  };

  return result;
};

const hasChange = <T extends object, K extends keyof T>(
  update: Partial<T>,
  master: Partial<T>,
  ignore: K[]
): boolean => {
  for (const key of Object.keys(update)) {
    if (ignore.includes(key as K)) {
      continue;
    }
    if (JSON.stringify(update[key as K]) !== JSON.stringify(master[key as K])) {
      return true;
    }
  }

  return false;
};

const isNoteChangeDoc = (
  changeDoc:
    | PouchDB.Core.ExistingDocument<any & PouchDB.Core.ChangesMeta>
    | undefined
): changeDoc is ExistingNoteDocWithChanges => {
  return changeDoc && changeDoc._id.startsWith(NOTE_PREFIX);
};

type EmitFunction = (type: string, ...args: any[]) => void;

export class NoteStore {
  db: PouchDB.Database;
  keywordsViewReady: Promise<PouchDB.Find.CreateIndexResponse<NoteContent>>;

  constructor(db: PouchDB.Database) {
    this.db = db;
    this.keywordsViewReady = this.db.createIndex({
      index: {
        fields: ['keywords'],
        name: 'keywords_index',
        ddoc: 'notes_by_keyword',
      },
    });
  }

  async destroy(): Promise<any> {
    return this.keywordsViewReady;
  }

  async getNote(id: string): Promise<Note> {
    return parseNote(await this.db.get<NoteContent>(NOTE_PREFIX + id));
  }

  async putNote(note: Partial<Note>): Promise<Note> {
    let noteDoc: ExistingNoteDoc | undefined;
    let missing = false;
    const now = new Date().getTime();

    if (!note.id) {
      const noteToPut: NoteDoc = {
        ...stripFields(note, ['id']),
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

      noteDoc = await (async function tryToPutNewNote(
        noteDoc,
        db
      ): Promise<ExistingNoteDoc> {
        let result;
        try {
          result = await db.put(noteDoc);
        } catch (err) {
          if (err.status !== 409) {
            throw err;
          }
          noteDoc._id = NOTE_PREFIX + generateUniqueTimestampId();
          return tryToPutNewNote(noteDoc, db);
        }

        return {
          ...noteToPut,
          _rev: result.rev,
        };
      })(noteToPut, this.db);
    } else {
      const noteUpdate: Partial<ExistingNoteDoc> = {
        ...stripFields(note, ['id', 'created']),
      };

      await this.db.upsert<NoteContent>(NOTE_PREFIX + note.id, doc => {
        // Doc was not found -- must have been deleted
        if (!doc.hasOwnProperty('_id')) {
          missing = true;
          return false;
        }

        noteDoc = {
          ...(doc as ExistingNoteDoc),
          ...noteUpdate,
        };

        // Check we actually have something to update.
        // We need to do this after filling-in noteDoc.
        if (!Object.keys(noteUpdate).length) {
          return false;
        }

        // Check for redundant changes.
        if (!hasChange(noteUpdate, doc, ['modified'])) {
          return false;
        }

        noteDoc.modified = now;

        // Drop empty optional fields.
        if (noteDoc.keywords && !noteDoc.keywords.length) {
          delete noteDoc.keywords;
        }

        return noteDoc;
      });
    }

    if (missing || !noteDoc) {
      const err: Error & { status?: number } = new Error('missing');
      err.status = 404;
      err.name = 'not_found';
      throw err;
    }

    return parseNote(noteDoc);
  }

  async deleteNote(id: string): Promise<void> {
    await stubbornDelete(NOTE_PREFIX + id, this.db);
  }

  async onChange(
    change: PouchDB.Core.ChangesResponseChange<{}>,
    emit: EmitFunction
  ) {
    if (!isNoteChangeDoc(change.doc)) {
      return;
    }

    emit('note', parseNote(change.doc));
  }

  async onSyncChange(
    doc: PouchDB.Core.ExistingDocument<{} & PouchDB.Core.ChangesMeta>
  ) {
    if (!isNoteChangeDoc(doc)) {
      return;
    }

    if (doc._deleted) {
      return;
    }

    const result = await this.db.get<NoteContent>(doc._id, {
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

  async getNotesForKeywords(keywords: string[]): Promise<Note[]> {
    /*
     * This should be a case-insensitive comparison but pouchdb-find doesn't
     * (yet) support case-insensitive indices or some of the other query
     * operators from MongoDB that let you do case-insensitive comparisons.
     *
     * We can actually work around this using RegExps but since that doesn't
     * work with $in we'd need to iterate over every item in |keywords| and then
     * build up a suitable escaped case-insensitive RegExp and run that over
     * each keyword in the candidate. That doesn't sound very scalable so
     * instead we just make this case-sensitive for the time being and hope that
     * users are carefully to follow the autocomplete prompts that guide them to
     * matchin the casing of previous keywords.
     *
     * If we need to support this and pouchdb-find can't help then perhaps we
     * can just save two copies of the keywords: original case plus lower case,
     * and then create the index on the lower case version.
     */
    const request: PouchDB.Find.FindRequest<NoteContent> = {
      selector: {
        _id: { $gt: NOTE_PREFIX, $lt: `${NOTE_PREFIX}\ufff0` },
        keywords: { $elemMatch: { $in: keywords } },
      },
    };
    const result = (await this.db.find(request)) as PouchDB.Find.FindResponse<
      NoteContent
    >;
    return result.docs.map(doc => parseNote(doc));
  }
}

export default NoteStore;
