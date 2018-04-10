import { Card } from '../model';
import { CardChange } from '../store/cards/CardStore';

let id = 0;

export type FormId = string | number;

// Generate a unique sequence number for each new card. This is used to track
// new cards when performing async actions that occur before they are saved
// (whereafter the card will be assigned a unique ID by the DB). We include this
// as part of the action so that reducer remains stateless.
function newCardId(): number {
  return ++id;
}

export type EditAction =
  | NewCardAction
  | LoadCardAction
  | FinishLoadCardAction
  | FailLoadCardAction
  | EditCardAction
  | FinishSaveCardAction
  | FailSaveCardAction
  | SyncEditCardAction
  | DeleteEditCardAction;

export interface NewCardAction {
  type: 'NEW_CARD';
  id: FormId;
}

export function newCard(id?: FormId): NewCardAction {
  return {
    type: 'NEW_CARD',
    id: typeof id === 'undefined' ? newCardId() : id,
  };
}

export interface LoadCardAction {
  type: 'LOAD_CARD';
  id: string;
}

export function loadCard(id: string): LoadCardAction {
  return {
    type: 'LOAD_CARD',
    id,
  };
}

export interface FinishLoadCardAction {
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

export interface FailLoadCardAction {
  type: 'FAIL_LOAD_CARD';
  formId: FormId;
  error: string | { reason: string };
}

export function failLoadCard(
  formId: FormId,
  error: string | { reason: string }
): FailLoadCardAction {
  return {
    type: 'FAIL_LOAD_CARD',
    formId,
    error,
  };
}

export interface EditCardAction {
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

export interface SaveEditCardAction {
  type: 'SAVE_EDIT_CARD';
  formId: FormId;
}

export function saveEditCard(formId: FormId): SaveEditCardAction {
  return {
    type: 'SAVE_EDIT_CARD',
    formId,
  };
}

export interface FinishSaveCardAction {
  type: 'FINISH_SAVE_CARD';
  formId: FormId;
  card: Partial<Card>;
}

export function finishSaveCard(
  formId: FormId,
  card: Partial<Card>
): FinishSaveCardAction {
  return {
    type: 'FINISH_SAVE_CARD',
    formId,
    card,
  };
}

export interface FailSaveCardAction {
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

export interface SyncEditCardAction {
  type: 'SYNC_EDIT_CARD';
  // XXX Rename this to change
  card: CardChange;
}

export function syncEditCard(card: CardChange): SyncEditCardAction {
  return {
    type: 'SYNC_EDIT_CARD',
    card,
  };
}

export interface DeleteEditCardAction {
  type: 'DELETE_EDIT_CARD';
  formId: FormId;
}

export function deleteEditCard(formId: FormId): DeleteEditCardAction {
  return {
    type: 'DELETE_EDIT_CARD',
    formId,
  };
}
