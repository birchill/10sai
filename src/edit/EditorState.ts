// This should be a const enum but doing that breaks ts-jest:
//
//   https://github.com/kulshekhar/ts-jest/issues/112
//
export enum EditorState {
  // Form is empty
  Empty = 'empty',

  // Card is loaded and all edits have been saved
  Ok = 'ok',

  // Loading a card from the DB
  Loading = 'loading',

  // Card not found in the DB
  NotFound = 'not found',
}

export default EditorState;
