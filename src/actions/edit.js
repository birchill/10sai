let id = 0;

// Generate a unique sequence number for each new card. This is used to track
// new cards when performing async actions that occur before they are saved
// (whereafter the card will be assigned a unique ID by the DB). We include this
// as part of the action so that reducer remains stateless.
function newCardId() {
  return ++id;
}

export function newCard(id) {
  return {
    type: 'NEW_CARD',
    id: typeof id === 'undefined' ? newCardId() : id,
  };
}

export function loadCard(id) {
  return {
    type: 'LOAD_CARD',
    id,
  };
}

export function finishLoadCard(formId, card) {
  return {
    type: 'FINISH_LOAD_CARD',
    formId,
    card,
  };
}

export function failLoadCard(formId, error) {
  return {
    type: 'FAIL_LOAD_CARD',
    formId,
    error,
  };
}

// |card| here only needs to specify the changed fields
export function editCard(formId, card) {
  return {
    type: 'EDIT_CARD',
    formId,
    card,
  };
}

export function saveEditCard(formId) {
  return {
    type: 'SAVE_EDIT_CARD',
    formId,
  };
}

export function finishSaveCard(formId, card) {
  return {
    type: 'FINISH_SAVE_CARD',
    formId,
    card,
  };
}

export function failSaveCard(formId, error) {
  return {
    type: 'FAIL_SAVE_CARD',
    formId,
    error,
  };
}

export function syncCard(card) {
  return {
    type: 'SYNC_CARD',
    card,
  };
}
