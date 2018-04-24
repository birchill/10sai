export const NOTE_PREFIX = 'note-';

export interface NoteRecord {
  _id: string;
  _rev?: string;
  keywords?: string[];
  content: string;
  created: number;
  modified: number;
}
