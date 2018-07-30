import { NoteState } from './reducer';

export const NoteSorter = (keywords: Array<string>) => {
  return (a: NoteState, b: NoteState): number => {
    // Calculate a score based on keyword matches such that matches closer to
    // the start of props.keywords trump those later.
    let aScore = 0;
    let bScore = 0;
    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i];
      if (a.originalKeywords.has(keyword)) {
        aScore |= 1 << (keywords.length - i - 1);
      }
      if (b.originalKeywords.has(keyword)) {
        bScore |= 1 << (keywords.length - i - 1);
      }
    }

    // Sort by keyword matches and then by formId
    return aScore === bScore ? a.formId - b.formId : bScore - aScore;
  };
};

export default NoteSorter;
