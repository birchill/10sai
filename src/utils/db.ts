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
