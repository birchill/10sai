import { NoteState } from './reducer';
import { getKeywordVariants } from '../text/keywords';

// Returns a *copy* of the sorted notes.
export const sortNotesByKeywordMatches = (
  notes: Array<NoteState>,
  keywords: Array<string>
): Array<NoteState> => {
  type NoteAndScore = {
    noteState: NoteState;
    score: number;
  };

  const keywordsToUse = [...keywords, ...getKeywordVariants(keywords)];

  // First iterate through each of the notes and assign a score.
  const notesWithScores = notes.map(noteState => {
    let score = 0;
    for (let i = 0; i < keywordsToUse.length; i++) {
      const keyword = keywordsToUse[i].toLowerCase();
      if (noteState.originalKeywords.has(keyword)) {
        score |= 1 << (keywordsToUse.length - i - 1);
      }
    }
    return {
      noteState,
      score,
    };
  });

  // Sort in place
  notesWithScores.sort((a: NoteAndScore, b: NoteAndScore) =>
    a.score === b.score
      ? a.noteState.formId - b.noteState.formId
      : b.score - a.score
  );

  // Unwrap
  return notesWithScores.map(noteAndScore => noteAndScore.noteState);
};
