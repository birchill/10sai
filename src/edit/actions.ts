import { Card } from '../model';
import { CardChange } from '../store/CardStore';
import { StoreError } from '../store/DataStore';

let id = 0;

// Generate a unique sequence number for each new form. We use this to track
// specific forms instances instead of the card ID since before saving
// a particular card will not yet have an ID.
//
// This ID is updated each time we start a new card or load a different card. In
// that sense it represents not the physical form elements, but an instance of
// a particular card being edited.
//
// We include this as part of the necessary actions so that reducer remains
// stateless.
function newFormId(): number {
  return ++id;
}

export type EditAction =
  | NewCardAction
  | LoadCardAction
  | FinishLoadCardAction
  | FailLoadCardAction
  | EditCardAction
  | SaveCardAction
  | FinishSaveCardAction
  | FailSaveCardAction
  | SyncEditCardAction
  | DeleteCardAction;

export type PrefilledCard = Partial<
  Pick<Card, 'front' | 'back' | 'keywords' | 'tags'>
>;

export interface NewCardAction {
  type: 'NEW_CARD';
  newFormId: number;
  card?: PrefilledCard;
}

export function newCard(
  card?: PrefilledCard,
  testFormId?: number
): NewCardAction {
  return {
    type: 'NEW_CARD',
    newFormId: typeof testFormId === 'undefined' ? newFormId() : testFormId,
    card,
  };
}

export interface LoadCardAction {
  type: 'LOAD_CARD';
  cardId: string;
  newFormId: number;
}

export function loadCard(cardId: string, testFormId?: number): LoadCardAction {
  return {
    type: 'LOAD_CARD',
    cardId,
    newFormId: typeof testFormId === 'undefined' ? newFormId() : testFormId,
  };
}

export interface FinishLoadCardAction {
  type: 'FINISH_LOAD_CARD';
  formId: number;
  card: Card;
}

export function finishLoadCard(
  formId: number,
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
  formId: number;
  error: StoreError;
}

export function failLoadCard(
  formId: number,
  error: StoreError
): FailLoadCardAction {
  return {
    type: 'FAIL_LOAD_CARD',
    formId,
    error,
  };
}

export interface EditCardAction {
  type: 'EDIT_CARD';
  formId: number;
  card: Partial<Card>;
}

// |card| here only needs to specify the changed fields
export function editCard(formId: number, card: Partial<Card>): EditCardAction {
  return {
    type: 'EDIT_CARD',
    formId,
    card,
  };
}

export interface SaveCardAction {
  type: 'SAVE_CARD';
  formId: number;
}

export function saveCard(formId: number): SaveCardAction {
  return {
    type: 'SAVE_CARD',
    formId,
  };
}

export interface FinishSaveCardAction {
  type: 'FINISH_SAVE_CARD';
  formId: number;
  card: Partial<Card>;
}

export function finishSaveCard(
  formId: number,
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
  formId: number;
  error: StoreError;
}

export function failSaveCard(
  formId: number,
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

// We need to pass the cardId as well since anyone dealing with this action
// after the reducer has run (e.g. sagas) might need to know the
// actual ID of the card that was deleted.
//
// (Note that even still we need to take care to check if there is a pending
// save and use the ID from that if there is.)
export interface DeleteCardAction {
  type: 'DELETE_CARD';
  formId: number;
  cardId?: string;
}

export function deleteCard(formId: number, cardId?: string): DeleteCardAction {
  return {
    type: 'DELETE_CARD',
    formId,
    cardId,
  };
}
