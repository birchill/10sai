let prevTimeStamp = 0;

/**
 * Generates a unique ID that should at least roughly reflect the current
 * timestamp such that subsequent calls to this produce IDs that are in
 * ascending order.
 */
export const generateUniqueTimestampId = (): string => {
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
};

/**
 * Keep trying to delete a document if conflicts are encountered.
 */
export const stubbornDelete = async (
  id: string,
  db: PouchDB.Database
): Promise<void> => {
  let doc;
  try {
    doc = await db.get(id);
  } catch (err) {
    // If the document is missing then just return
    if (err.status === 404) {
      return;
    }
    throw err;
  }

  try {
    await db.remove(doc);
    return;
  } catch (err) {
    if (err.status !== 409) {
      throw err;
    }
    // If there is a conflict, just keep trying
    doc = await db.get(id);
    return stubbornDelete(doc._id, db);
  }
};

interface UpdateViewOptions {
  db: PouchDB.Database;
  view: string;
  mapFunction: string;
  reduce?: string | boolean;
  prefetch?: boolean;
}

/**
 * Create/update a view.
 */
export const updateView = async (options: UpdateViewOptions): Promise<void> => {
  const { db, view, mapFunction, reduce, prefetch } = options;

  const result: PouchDB.UpsertResponse = await db.upsert(
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
  );

  if (!prefetch) {
    return;
  }

  // Don't return the promise from this. Just trigger the query so it can
  // run in the background.
  db.query(view, { limit: 0 }).catch(() => {
    // Ignore errors from this. We hit this often during unit tests where
    // we destroy the database before the query gets a chance to run.
  });
};

// Unfortunately the PouchDB typings forgot the 'name' member of Database.
// FIXME: File a PR for this.
export type DatabaseWithName = PouchDB.Database & { name: string };
