import { FormId } from '../edit/reducer';
import { Action } from 'redux';
import { Note } from '../model';

export type NoteContext = EditNoteContext | ReviewNoteContext;

export interface EditNoteContext {
  screen: 'edit';
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
