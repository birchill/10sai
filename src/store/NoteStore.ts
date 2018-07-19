import { Note } from '../model';
import * as views from './views';
import { generateUniqueTimestampId, updateView, stubbornDelete } from './utils';
import { Omit, stripFields } from '../utils/type-helpers';
import { collate } from 'pouchdb-collate';

export interface NoteContent {
  keywords?: string[];
  // A copy of keywords suitable for indexing. Currently this is just
  // a lowercased version but it might, in future, be useful to store other
  // variants like hiragana version of kanji keywords, normalized versions of
  // hangul, etc.
  keywords_idx?: string[];
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
    ...stripFields(note as ExistingNoteDoc, ['_id', '_rev', 'keywords_idx']),
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
        fields: ['keywords_idx'],
        name: 'keywords_idx',
        ddoc: 'notes_by_keywords',
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

      // Store lower-case version of keywords
      if (noteToPut.keywords) {
        noteToPut.keywords_idx = noteToPut.keywords.map(keyword =>
          keyword.toLowerCase()
        );
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
    // We store a lowercased version of the keywords as keyword_idx so that we
    // can create an index on that and compare to that.
    //
    // Although PouchDB lets us create views where we could achieve the same
    // effect, those views are quite expensive to warm up. Furthermore, ideally
    // in future we'd like to use IndexedDB native indices and they don't
    // support changing case.
    const keywordsToMatch = keywords
      .map(keyword => keyword.toLowerCase())
      // Skip any empty keywords
      .filter(keyword => keyword.length > 0);
    const request: PouchDB.Find.FindRequest<NoteContent> = {
      selector: {
        _id: { $gt: NOTE_PREFIX, $lt: `${NOTE_PREFIX}\ufff0` },
        keywords_idx: { $elemMatch: { $in: keywordsToMatch } },
      },
    };
    const result = (await this.db.find(request)) as PouchDB.Find.FindResponse<
      NoteContent
    >;
    return result.docs.map(doc => parseNote(doc));
  }
}

export default NoteStore;
