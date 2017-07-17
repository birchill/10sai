export const EditState = {
  EMPTY: Symbol('EMPTY'), // Form is empty
  DIRTY_NEW: Symbol('DIRTY_NEW'), // Started writing a new card but have yet to
                                  // save it once
  OK: Symbol('OK'), // Card is loaded and all edits have been saved
  DIRTY_EDIT: Symbol('DIRTY_EDIT'), // Edits have been made to the card that
                                    // have yet to be saved
  LOADING: Symbol('LOADING'), // Loading a card from the DB
  NOT_FOUND: Symbol('NOT_FOUND'), // Card not found in the DB
};

export default EditState;
