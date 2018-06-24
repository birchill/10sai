// This should be a const enum but doing that breaks ts-jest:
//
//   https://github.com/kulshekhar/ts-jest/issues/112
//
export enum EditorState {
  // Form is empty
  Empty = 'empty',

  // Started editing a card but have yet to save it once
  // (A never-saved card can be distinguished from
  // a once-saved but dirty card by the presence of an
  // ID on the card)
  Dirty = 'dirty',

  // Card is loaded and all edits have been saved
  Ok = 'ok',

  // Loading a card from the DB
  Loading = 'loading',

  // Card not found in the DB
  NotFound = 'not found',
}

export default EditorState;
