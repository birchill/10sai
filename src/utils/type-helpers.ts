/**
 * A variant on Pick that excludes the listed members from T.
 */
export type Omit<T, K extends keyof T> = Pick<
  T,
  ({ [P in keyof T]: P } &
    { [P in K]: never } & { [x: string]: never })[keyof T]
>;

/**
 * Like Partial, but scoped to the specified members.
 */
export type MakeOptional<T, K extends keyof T> = Omit<T, K> &
  Pick<Partial<T>, K>;

/**
 * Another variant on Partial that applies to nested members too.
 */
export type DeepPartial<T> = { [P in keyof T]?: DeepPartial<T[P]> };
