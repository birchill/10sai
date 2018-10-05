export const styleClassMapping = new Map<string, string>([
  ['b', 'bold'],
  ['i', 'italic'],
  ['u', 'underline'],
  ['.', 'dotemphasis'],
]);

export type ColorKeyword = 'green' | 'blue' | 'purple' | 'red' | 'orange';

export type ColorKeywordOrBlack = ColorKeyword | 'black';

export const ColorKeywords: Array<ColorKeyword> = [
  'green',
  'blue',
  'purple',
  'red',
  'orange',
];
