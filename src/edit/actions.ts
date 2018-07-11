import { Card } from '../model';
import { FormId } from './reducer';
import { CardChange } from '../store/CardStore';
import { StoreError } from '../store/DataStore';

let id = 0;

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
  | DeleteCardAction;

export interface NewCardAction {
  type: 'NEW_CARD';
  newId: number;
}

export function newCard(newId?: number): NewCardAction {
  return {
    type: 'NEW_CARD',
    newId: typeof newId === 'undefined' ? newCardId() : newId,
  };
}

export interface LoadCardAction {
  type: 'LOAD_CARD';
  cardId: string;
}

export function loadCard(cardId: string): LoadCardAction {
  return {
    type: 'LOAD_CARD',
    cardId,
  };
}

export interface FinishLoadCardAction {
  type: 'FINISH_LOAD_CARD';
  cardId: string;
  card: Card;
}

export function finishLoadCard(
  cardId: string,
  card: Card
): FinishLoadCardAction {
  return {
    type: 'FINISH_LOAD_CARD',
    cardId,
    card,
  };
}

export interface FailLoadCardAction {
  type: 'FAIL_LOAD_CARD';
  cardId: string;
  error: StoreError;
}

export function failLoadCard(
  cardId: string,
  error: StoreError
): FailLoadCardAction {
  return {
    type: 'FAIL_LOAD_CARD',
    cardId,
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

export interface SaveCardAction {
  type: 'SAVE_CARD';
  formId: FormId;
}

export function saveCard(formId: FormId): SaveCardAction {
  return {
    type: 'SAVE_CARD',
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
  error: StoreError;
}

export function failSaveCard(
  formId: FormId,
  error: StoreError
): FailSaveCardAction {
  return {
    type: 'FAIL_SAVE_CARD',
    formId,
    error,
  };
}

export interface SyncEditCardAction {
  type: 'SYNC_EDIT_CARD';
  change: CardChange;
}

export function syncEditCard(change: CardChange): SyncEditCardAction {
  return {
    type: 'SYNC_EDIT_CARD',
    change,
  };
}

export interface DeleteCardAction {
  type: 'DELETE_CARD';
  formId: FormId;
}

export function deleteCard(formId: FormId): DeleteCardAction {
  return {
    type: 'DELETE_CARD',
    formId,
  };
}
