// This should be a const enum but doing that breaks ts-jest:
//
//   https://github.com/kulshekhar/ts-jest/issues/112
//
export enum FormState {
  // Card is ready
  Ok = 'ok',

  // Loading a card from the DB
  Loading = 'loading',

  // Card not found in the DB
  NotFound = 'not found',

  // Card not found because it was deleted
  Deleted = 'deleted',
}

export default FormState;
