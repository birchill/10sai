import { Action } from 'redux';
import { Note } from '../model';
import { StoreError } from '../store/DataStore';

interface BareEditNoteContext {
  screen: 'edit-card';
  cardFormId: number;
}

interface BareReviewNoteContext {
  screen: 'review';
}

type BareNoteContext = BareEditNoteContext | BareReviewNoteContext;

interface NoteContextCommon {
  noteFormId: number;
}

export type EditNoteContext = BareEditNoteContext & NoteContextCommon;
export type ReviewNoteContext = BareReviewNoteContext & NoteContextCommon;
export type NoteContext = EditNoteContext | ReviewNoteContext;

export type NoteAction =
  | AddNoteAction
  | EditNoteAction
  | DeleteNoteAction
  | SaveNoteAction
  | FinishSaveNoteAction
  | FailSaveNoteAction;

export const isNoteAction = (action: Action): action is NoteAction =>
  ['ADD_NOTE', 'EDIT_NOTE', 'DELETE_NOTE'].includes(action.type);

let id = 0;

// Generate a unique sequence number for each new note. (Technically this only
// needs to be unique per context but it's just easier to make it globally
// unique.) As with cards, we include this as part of the action so that reducer
// remains stateless.
function newFormId(): number {
  return ++id;
}

export interface AddNoteAction {
  type: 'ADD_NOTE';
  context: NoteContext;
  initialKeywords?: string[];
}

export function addNote(
  context: BareNoteContext,
  initialKeywords?: string[]
): AddNoteAction {
  return {
    type: 'ADD_NOTE',
    context: {
      ...context,
      noteFormId: newFormId(),
    },
    initialKeywords,
  };
}

// Overload for unit testing that allows us to force the ID to a particular
// number to make tests more independent.
export function addNoteWithNewFormId(
  context: BareNoteContext,
  noteFormId: number,
  initialKeywords?: string[]
): AddNoteAction {
  return {
    type: 'ADD_NOTE',
    context: {
      ...context,
      noteFormId,
    },
    initialKeywords,
  };
}

export interface EditNoteAction {
  type: 'EDIT_NOTE';
  context: NoteContext;
  change: Partial<Note>;
}

export function editNote(
  context: NoteContext,
  change: Partial<Note>
): EditNoteAction {
  return {
    type: 'EDIT_NOTE',
    context,
    change,
  };
}

export interface SaveNoteAction {
  type: 'SAVE_NOTE';
  context: NoteContext;
}

export function saveNote(context: NoteContext): SaveNoteAction {
  return {
    type: 'SAVE_NOTE',
    context,
  };
}

export interface FinishSaveNoteAction {
  type: 'FINISH_SAVE_NOTE';
  context: NoteContext;
  note: Partial<Note>;
}

export function finishSaveNote(
  context: NoteContext,
  savedNote: Partial<Note>
): FinishSaveNoteAction {
  return {
    type: 'FINISH_SAVE_NOTE',
    context,
    note: savedNote,
  };
}

export interface FailSaveNoteAction {
  type: 'FAIL_SAVE_NOTE';
  context: NoteContext;
  error: StoreError;
}

export function failSaveNote(
  context: NoteContext,
  error: StoreError
): FailSaveNoteAction {
  return {
    type: 'FAIL_SAVE_NOTE',
    context,
    error,
  };
}

export interface DeleteNoteAction {
  type: 'DELETE_NOTE';
  context: NoteContext;
  noteId?: string;
}

export function deleteNote(
  context: NoteContext,
  noteId?: string
): DeleteNoteAction {
  return {
    type: 'DELETE_NOTE',
    context,
    noteId,
  };
}
