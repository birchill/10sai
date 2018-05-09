export const NOTE_PREFIX = 'note-';

export interface NoteContent {
  keywords?: string[];
  content: string;
  created: number;
  modified: number;
}
