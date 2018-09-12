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
    expect(fromDraft(input)).toEqual([
      {
        type: 'text',
        children: [
          'abc',
          {
            type: 'text',
            children: [
              'd',
              {
                type: 'text',
                styles: ['i'],
                children: ['e'],
              },
              'f',
            ],
            styles: ['b'],
          },
          'ghi',
        ],
      },
    ]);
  });

  it('converts partially-overlapping ranges', () => {
    const input: RawDraftContentState = {
      blocks: [
        {
          depth: 0,
          data: {},
          entityRanges: [],
          inlineStyleRanges: [
            {
              length: 3,
              offset: 1,
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
    expect(fromDraft(input)).toEqual([
      {
        type: 'text',
        children: [
          'a',
          {
            type: 'text',
            styles: ['b'],
            children: [
              'b',
              {
                type: 'text',
                styles: ['i'],
                children: ['cd'],
              },
            ],
          },
          {
            type: 'text',
            styles: ['i'],
            children: ['e'],
          },
          'f',
        ],
      },
    ]);
  });

  it('converts ranges with equal ends', () => {
    const input: RawDraftContentState = {
      blocks: [
        {
          depth: 0,
          data: {},
          entityRanges: [],
          inlineStyleRanges: [
            {
              length: 3,
              offset: 1,
              style: 'BOLD',
            },
            {
              length: 2,
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
    expect(fromDraft(input)).toEqual([
      {
        type: 'text',
        children: [
          'a',
          {
            type: 'text',
            styles: ['b'],
            children: [
              'b',
              {
                type: 'text',
                styles: ['i'],
                children: ['cd'],
              },
            ],
          },
          'ef',
        ],
      },
    ]);
  });

  it('converts partially-overlapping ranges', () => {
    const input: RawDraftContentState = {
      blocks: [
        {
          depth: 0,
          data: {},
          entityRanges: [],
          inlineStyleRanges: [
            {
              length: 3,
              offset: 1,
              style: 'BOLD',
            },
            {
              length: 2,
              offset: 1,
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
    expect(fromDraft(input)).toEqual([
      {
        type: 'text',
        children: [
          'a',
          {
            type: 'text',
            styles: ['b', 'i'],
            children: ['bc'],
          },
          {
            type: 'text',
            styles: ['b'],
            children: ['d'],
          },
          'ef',
        ],
      },
    ]);
  });

  it('treats offsets as codepoint offsets', () => {
    const input: RawDraftContentState = {
      blocks: [
        {
          depth: 0,
          data: {},
          entityRanges: [],
          inlineStyleRanges: [
            {
              length: 2,
              offset: 1,
              style: 'BOLD',
            },
          ],
          key: 'yer',
          text: '𠀀𠀁𠀆𠀂',
          type: 'unstyled',
        },
      ],
      entityMap: {},
    };
    expect(fromDraft(input)).toEqual([
      {
        type: 'text',
        children: [
          '𠀀',
          { type: 'text', children: ['𠀁𠀆'], styles: ['b'] },
          '𠀂',
        ],
      },
    ]);
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
    expect(fromDraft(input)).toEqual([
      { type: 'text', children: ['abc'] },
      { type: 'text', children: ['def'] },
    ]);
  });

  it('drops SELECTION styles', () => {
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
              length: 3,
              offset: 2,
              style: 'SELECTION',
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
});
