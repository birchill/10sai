import { RawDraftContentState } from 'draft-js';

// draft-js typings here make all these members required but most of them are
// optional.
declare module 'draft-js' {
  interface RawDraftContentBlock {
    key?: string;
    type: string;
    text: string;
    depth?: number;
    inlineStyleRanges?: Array<RawDraftInlineStyleRange>;
    entityRanges?: Array<RawDraftEntityRange>;
    data?: any;
    children?: Array<RawDraftContentBlock>;
  }
}
