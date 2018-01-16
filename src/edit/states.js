export const EditState = {
  // Form is empty
  EMPTY: Symbol('EMPTY'),

  // Started editing a card but have yet to save it once
  // (A never-saved card can be distinguished from
  // a once-saved but dirty card by the presence of an
  // ID on the card)
  DIRTY: Symbol('DIRTY'),

  // Card is loaded and all edits have been saved
  OK: Symbol('OK'),

  // Loading a card from the DB
  LOADING: Symbol('LOADING'),

  // Card not found in the DB
  NOT_FOUND: Symbol('NOT_FOUND'),
};

export default EditState;
