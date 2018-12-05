declare module 'pouchdb-collate' {
  /**
   * Given two objects, return a number comparing them.
   */
  export function collate(a: any, b: any): number;

  /**
   * You shouldn't need to use this, but this function will normalize the object
   * and return what CouchDB would expect - e.g. undefined becomes null, and
   * Dates become date.toJSON(). It's basically what you would get if you
   * called:
   *
   *   JSON.parse(JSON.stringify(obj));
   *
   */
  export function normalizeKey(key: any): null | number | string | object;

  /**
   * Converts any object to a serialized string that maintains proper CouchDB
   * collation ordering in both PouchDB and CouchDB (ignoring some subtleties
   * with ICU string ordering in CouchDB vs. ASCII string ordering in PouchDB).
   */
  export function toIndexableString(key: any): string;

  /**
   * Given an indexable string, it'll give you back a structured object.
   *
   * @param str The string to parse.
   */
  export function parseIndexableString(str: string): object;
}
