import { Card } from '../model';

let id = 0;

type FormId = string | number;

// Generate a unique sequence number for each new card. This is used to track
// new cards when performing async actions that occur before they are saved
// (whereafter the card will be assigned a unique ID by the DB). We include this
// as part of the action so that reducer remains stateless.
function newCardId(): number {
  return ++id;
}

interface NewCardAction {
  type: 'NEW_CARD';
  id: FormId;
}

export function newCard(id?: string): NewCardAction {
  return {
    type: 'NEW_CARD',
    id: typeof id === 'undefined' ? newCardId() : id,
  };
}

interface LoadCardAction {
  type: 'LOAD_CARD';
  id: string;
}

export function loadCard(id: string): LoadCardAction {
  return {
    type: 'LOAD_CARD',
    id,
  };
}

interface FinishLoadCardAction {
  type: 'FINISH_LOAD_CARD';
  formId: FormId;
  card: Card;
}

export function finishLoadCard(
  formId: FormId,
  card: Card
): FinishLoadCardAction {
  return {
    type: 'FINISH_LOAD_CARD',
    formId,
    card,
  };
}

interface FailLoadCardAction {
  type: 'FAIL_LOAD_CARD';
  formId: FormId;
  error: string;
}

export function failLoadCard(
  formId: FormId,
  error: string
): FailLoadCardAction {
  return {
    type: 'FAIL_LOAD_CARD',
    formId,
    error,
  };
}

interface EditCardAction {
  type: 'EDIT_CARD';
  formId: FormId;
  card: Partial<Card>;
}

// |card| here only needs to specify the changed fields
export function editCard(formId: FormId, card: Partial<Card>): EditCardAction {
  return {
    type: 'EDIT_CARD',
    formId,
    card,
  };
}

interface SaveEditCard {
  type: 'SAVE_EDIT_CARD';
  formId: FormId;
}

export function saveEditCard(formId: FormId): SaveEditCard {
  return {
    type: 'SAVE_EDIT_CARD',
    formId,
  };
}

interface FinishSaveCard {
  type: 'FINISH_SAVE_CARD';
  formId: FormId;
  card: Card;
}

export function finishSaveCard(formId: FormId, card: Card): FinishSaveCard {
  return {
    type: 'FINISH_SAVE_CARD',
    formId,
    card,
  };
}

interface FailSaveCardAction {
  type: 'FAIL_SAVE_CARD';
  formId: FormId;
  error: string;
}

export function failSaveCard(
  formId: FormId,
  error: string
): FailSaveCardAction {
  return {
    type: 'FAIL_SAVE_CARD',
    formId,
    error,
  };
}

interface SyncEditCard {
  type: 'SYNC_EDIT_CARD';
  card: Card;
}

export function syncEditCard(card: Card): SyncEditCard {
  return {
    type: 'SYNC_EDIT_CARD',
    card,
  };
}

interface DeleteEditCard {
  type: 'DELETE_EDIT_CARD';
  formId: FormId;
}

export function deleteEditCard(formId: FormId): DeleteEditCard {
  return {
    type: 'DELETE_EDIT_CARD',
    formId,
  };
}
