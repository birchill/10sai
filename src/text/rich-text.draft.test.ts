import { RawDraftContentState } from 'draft-js';
import { fromDraft } from './rich-text';

describe('fromDraft', () => {
  it('converts a simple string', () => {
    const input: RawDraftContentState = {
      blocks: [
        {
          depth: 0,
          data: {},
          entityRanges: [],
          inlineStyleRanges: [],
          key: 'yer',
          text: 'abc',
          type: 'unstyled',
        },
      ],
      entityMap: {},
    };
    expect(fromDraft(input)).toEqual([{ type: 'text', children: ['abc'] }]);
  });

  it('converts an inline range', () => {
    const input: RawDraftContentState = {
      blocks: [
        {
          depth: 0,
          data: {},
          entityRanges: [],
          inlineStyleRanges: [
            {
              length: 3,
              offset: 3,
              style: 'BOLD',
            },
          ],
          key: 'yer',
          text: 'abcdefghi',
          type: 'unstyled',
        },
      ],
      entityMap: {},
    };
    expect(fromDraft(input)).toEqual([
      {
        type: 'text',
        children: [
          'abc',
          { type: 'text', children: ['def'], styles: ['b'] },
          'ghi',
        ],
      },
    ]);
  });

  it('converts nested inline ranges', () => {
    const input: RawDraftContentState = {
      blocks: [
        {
          depth: 0,
          data: {},
          entityRanges: [],
          inlineStyleRanges: [
            {
              length: 3,
              offset: 3,
              style: 'BOLD',
            },
            {
              length: 1,
              offset: 4,
              style: 'ITALIC',
            },
          ],
          key: 'yer',
          text: 'abcdefghi',
          type: 'unstyled',
        },
      ],
      entityMap: {},
    };
  });

  it('converts overlapping ranges', () => {
    const input: RawDraftContentState = {
      blocks: [
        {
          depth: 0,
          data: {},
          entityRanges: [],
          inlineStyleRanges: [
            {
              length: 1,
              offset: 3,
              style: 'BOLD',
            },
            {
              length: 3,
              offset: 2,
              style: 'ITALIC',
            },
          ],
          key: 'yer',
          text: 'abcdef',
          type: 'unstyled',
        },
      ],
      entityMap: {},
    };
  });

  it('converts multiple blocks', () => {
    const input: RawDraftContentState = {
      blocks: [
        {
          depth: 0,
          data: {},
          entityRanges: [],
          inlineStyleRanges: [],
          key: 'yer',
          text: 'abc',
          type: 'unstyled',
        },
        {
          depth: 0,
          data: {},
          entityRanges: [],
          inlineStyleRanges: [],
          key: 'bar',
          text: 'def',
          type: 'unstyled',
        },
      ],
      entityMap: {},
    };
  });

  // XXX Drops SELECTION styles
});
