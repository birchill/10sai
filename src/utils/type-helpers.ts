/**
 * A variant on Pick that excludes the listed members from T.
 */
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

/**
 * Intersection of T & U but with the types of U being used where they overlap.
 */
export type Overwrite<T, U> = Omit<T, Extract<keyof T, keyof U>> & U;

/**
 * Like Partial, but scoped to the specified members.
 */
export type MakeOptional<T, K extends keyof T> = Omit<T, K> &
  Pick<Partial<T>, K>;

/**
 * The inverse of MakeOptional -- make only the specified members required.
 */
export type MakeOnlyRequired<T, K extends keyof T> = Omit<Partial<T>, K> &
  Pick<T, K>;

/**
 * A variant on Partial that applies to nested members too.
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T[P] extends ReadonlyArray<infer U>
      ? ReadonlyArray<DeepPartial<U>>
      : DeepPartial<T[P]>
};

/**
 * A helper to strip certain fields from an object.
 */
export function stripFields<T extends object, K extends keyof T>(
  o: T,
  fields: K[]
): Omit<T, K> {
  const result: Partial<T> = { ...(<object>o) };
  for (const field of fields) {
    delete result[field];
  }
  return <Omit<T, K>>result;
}
