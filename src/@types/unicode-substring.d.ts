declare module 'unicode-substring' {
  // Technically the start / end arguments should be any since unicodeSubstring
  // does 'toNumber' on them, but for now it's better to be restrictive.
  function unicodeSubstring(
    string: string,
    start: number,
    end?: number
  ): string;
  export = unicodeSubstring;
}
