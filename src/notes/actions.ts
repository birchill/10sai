import { FormId } from '../edit/reducer';
import { Action } from 'redux';
import { Note } from '../model';
import { StoreError } from '../store/DataStore';

export type NoteContext = EditNoteContext | ReviewNoteContext;

export interface EditNoteContext {
  screen: 'edit-card';
  formId: FormId;
}

export interface ReviewNoteContext {
  screen: 'review';
}

export type NoteAction = AddNoteAction | EditNoteAction;

export const isNoteAction = (action: Action): action is NoteAction =>
  ['ADD_NOTE', 'EDIT_NOTE'].includes(action.type);

let id = 0;

// Generate a unique sequence number for each new note. (Technically this only
// needs to be unique per context but it's just easier to make it globally
// unique.) As with cards, we include this as part of the action so that reducer
// remains stateless.
function newNoteId(): number {
  return ++id;
}

export interface AddNoteAction {
  type: 'ADD_NOTE';
  context: NoteContext;
  newId: number;
  initialKeywords?: string[];
}

export function addNote(
  context: NoteContext,
  initialKeywords?: string[]
): AddNoteAction {
  return {
    type: 'ADD_NOTE',
    context,
    newId: newNoteId(),
    initialKeywords,
  };
}

// Overload for unit testing that allows us to force the ID to a particular
// number to make tests more independent.
export function addNoteWithNewId(
  context: NoteContext,
  newId: number,
  initialKeywords?: string[]
): AddNoteAction {
  return {
    type: 'ADD_NOTE',
    context,
    newId,
    initialKeywords,
  };
}

export interface NoteIdentifiers {
  newId?: number;
  noteId?: string;
}

export interface EditNoteAction extends NoteIdentifiers {
  type: 'EDIT_NOTE';
  context: NoteContext;
  change: Partial<Note>;
}

export function editNote(
  context: NoteContext,
  note: NoteIdentifiers,
  change: Partial<Note>
): EditNoteAction {
  return {
    type: 'EDIT_NOTE',
    context,
    newId: note.newId,
    noteId: note.noteId,
    change,
  };
}

export interface SaveNoteAction extends NoteIdentifiers {
  type: 'SAVE_NOTE';
  context: NoteContext;
}

export function saveNote(
  context: NoteContext,
  note: NoteIdentifiers
): SaveNoteAction {
  return {
    type: 'SAVE_NOTE',
    context,
    newId: note.newId,
    noteId: note.noteId,
  };
}

export interface FinishSaveNoteAction extends NoteIdentifiers {
  type: 'FINISH_SAVE_NOTE';
  context: NoteContext;
  note: Partial<Note>;
}

export function finishSaveNote(
  context: NoteContext,
  note: NoteIdentifiers,
  savedNote: Partial<Note>
): FinishSaveNoteAction {
  return {
    type: 'FINISH_SAVE_NOTE',
    context,
    newId: note.newId,
    noteId: note.noteId,
    note: savedNote,
  };
}

export interface FailSaveNoteAction extends NoteIdentifiers {
  type: 'FAIL_SAVE_NOTE';
  context: NoteContext;
  error: StoreError;
}

export function failSaveNote(
  context: NoteContext,
  note: NoteIdentifiers,
  error: StoreError
): FailSaveNoteAction {
  return {
    type: 'FAIL_SAVE_NOTE',
    context,
    newId: note.newId,
    noteId: note.noteId,
    error,
  };
}
