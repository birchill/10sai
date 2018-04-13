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
 * A variant on Partial that applies to nested members too.
 */
export type DeepPartial<T> = { [P in keyof T]?: DeepPartial<T[P]> };
