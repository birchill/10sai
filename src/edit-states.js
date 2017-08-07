export const EditState = {
  EMPTY: Symbol('EMPTY'), // Form is empty
  DIRTY: Symbol('DIRTY'), // Started editing a card but have yet to save it once
                          // (A never-saved card can be distinguished from
                          // a once-saved but dirty card by the presence of an
                          // ID on the card)
  OK: Symbol('OK'), // Card is loaded and all edits have been saved
  LOADING: Symbol('LOADING'), // Loading a card from the DB
  NOT_FOUND: Symbol('NOT_FOUND'), // Card not found in the DB
};

export default EditState;
