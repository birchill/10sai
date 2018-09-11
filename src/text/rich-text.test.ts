import { deserialize } from './rich-text';

describe('deserialize', () => {
  it('parses valid plain text strings', () => {
    expect(deserialize('')).toEqual([]);
    expect(deserialize('a')).toEqual([{ type: 'text', children: ['a'] }]);
    expect(deserialize(' ')).toEqual([{ type: 'text', children: [' '] }]);
    expect(deserialize('abc')).toEqual([{ type: 'text', children: ['abc'] }]);
  });

  it('parses valid inlines', () => {
    // Simplest case
    expect(deserialize('abc􅨐b􅨑def􅨜ghi')).toEqual([
      {
        type: 'text',
        children: [
          'abc',
          { type: 'text', styles: ['b'], children: ['def'] },
          'ghi',
        ],
      },
    ]);
    // Inline appears at start
    expect(deserialize('􅨐b􅨑abc􅨜def')).toEqual([
      {
        type: 'text',
        children: [{ type: 'text', styles: ['b'], children: ['abc'] }, 'def'],
      },
    ]);
    // Inline appears at index 1
    expect(deserialize('a􅨐b􅨑bcd􅨜ef')).toEqual([
      {
        type: 'text',
        children: [
          'a',
          { type: 'text', styles: ['b'], children: ['bcd'] },
          'ef',
        ],
      },
    ]);
    // Inline appears at end
    expect(deserialize('abc􅨐b􅨑def􅨜')).toEqual([
      {
        type: 'text',
        children: ['abc', { type: 'text', styles: ['b'], children: ['def'] }],
      },
    ]);
    // Inline appears just before end
    expect(deserialize('abc􅨐b􅨑def􅨜g')).toEqual([
      {
        type: 'text',
        children: [
          'abc',
          { type: 'text', styles: ['b'], children: ['def'] },
          'g',
        ],
      },
    ]);
    // Inline only
    expect(deserialize('􅨐b􅨑a􅨜')).toEqual([
      {
        type: 'text',
        children: [{ type: 'text', styles: ['b'], children: ['a'] }],
      },
    ]);
    // Empty inline body
    expect(deserialize('abc􅨐b􅨑􅨜')).toEqual([
      {
        type: 'text',
        children: ['abc', { type: 'text', styles: ['b'], children: [] }],
      },
    ]);
    // Empty inline header
    expect(deserialize('abc􅨐􅨑def􅨜')).toEqual([
      {
        type: 'text',
        children: ['abc', { type: 'text', styles: [], children: ['def'] }],
      },
    ]);
    // Empty inline header and body
    expect(deserialize('abc􅨐􅨑􅨜')).toEqual([
      {
        type: 'text',
        children: ['abc', { type: 'text', styles: [], children: [] }],
      },
    ]);
    // Empty inline header and body only
    expect(deserialize('􅨐􅨑􅨜')).toEqual([
      {
        type: 'text',
        children: [{ type: 'text', styles: [], children: [] }],
      },
    ]);
    // Multiple inlines separated by text
    expect(deserialize('abc􅨐b􅨑def􅨜ghi􅨐i􅨑jkl􅨜mno')).toEqual([
      {
        type: 'text',
        children: [
          'abc',
          { type: 'text', styles: ['b'], children: ['def'] },
          'ghi',
          { type: 'text', styles: ['i'], children: ['jkl'] },
          'mno',
        ],
      },
    ]);
    // Multiple inlines back to back
    expect(deserialize('􅨐b􅨑abc􅨜􅨐italic􅨑def􅨜')).toEqual([
      {
        type: 'text',
        children: [
          { type: 'text', styles: ['b'], children: ['abc'] },
          { type: 'text', styles: ['italic'], children: ['def'] },
        ],
      },
    ]);
  });

  it('parses multiple inline styles', () => {
    expect(deserialize('􅨐b􅨝i􅨝u􅨑a􅨜')).toEqual([
      {
        type: 'text',
        children: [{ type: 'text', styles: ['b', 'i', 'u'], children: ['a'] }],
      },
    ]);
    // Empty style
    expect(deserialize('􅨐b􅨝􅨝u􅨑a􅨜')).toEqual([
      {
        type: 'text',
        children: [{ type: 'text', styles: ['b', 'u'], children: ['a'] }],
      },
    ]);
  });

  it('parses nested inlines', () => {
    expect(deserialize('􅨐b􅨑abc􅨐i􅨑def􅨜􅨜')).toEqual([
      {
        type: 'text',
        children: [
          {
            type: 'text',
            styles: ['b'],
            children: [
              'abc',
              { type: 'text', styles: ['i'], children: ['def'] },
            ],
          },
        ],
      },
    ]);
  });

  it('rejects invalid inlines', () => {
    // No inline end
    expect(() => {
      deserialize('abc􅨐b􅨑def');
    }).toThrow();
    // End appearing without start
    expect(() => {
      deserialize('abc􅨑def');
    }).toThrow();
    // Header end appearing without start
    expect(() => {
      deserialize('abc􅨑def');
    }).toThrow();
    // Delimeter appearing without start
    expect(() => {
      deserialize('abc􅨝def');
    }).toThrow();
    // No header end
    expect(() => {
      deserialize('abc􅨐bdef􅨜');
    }).toThrow();
    // Header end twice
    expect(() => {
      deserialize('abc􅨐b􅨑􅨑def􅨜');
    }).toThrow();
    // Header delimeter in body
    expect(() => {
      deserialize('abc􅨐b􅨑de􅨝f􅨜');
    }).toThrow();
  });

  it('parses custom inlines', () => {
    // With data
    expect(deserialize('abc􅨐!link:http://yer.com􅨑def􅨜ghi')).toEqual([
      {
        type: 'text',
        children: [
          'abc',
          {
            type: 'link',
            styles: [],
            children: ['def'],
            data: 'http://yer.com',
          },
          'ghi',
        ],
      },
    ]);
    // Without data
    expect(deserialize('abc􅨐!link􅨑http://yer.com􅨜ghi')).toEqual([
      {
        type: 'text',
        children: [
          'abc',
          {
            type: 'link',
            styles: [],
            children: ['http://yer.com'],
          },
          'ghi',
        ],
      },
    ]);
  });

  it('rejects invalid custom inlines', () => {
    // Custom inline name is zero-length
    expect(() => {
      deserialize('abc􅨐!􅨑def􅨜');
    }).toThrow();
    // Custom inline name is zero-length and has data
    expect(() => {
      deserialize('abc􅨐!:abc􅨑def􅨜');
    }).toThrow();
    // First colon is at end
    expect(() => {
      deserialize('abc􅨐!a:􅨑def􅨜');
    }).toThrow();
  });

  it('passes through astral characters', () => {
    // (These characters are just the first few that appear in CJK Unified
    // Ideographs Extension B)
    expect(deserialize('𠀀𠀁􅨐!𠀆:𠀊􅨝𠀂􅨑𠀃􅨜𠀄')).toEqual([
      {
        type: 'text',
        children: [
          '𠀀𠀁',
          { type: '𠀆', styles: ['𠀂'], children: ['𠀃'], data: '𠀊' },
          '𠀄',
        ],
      },
    ]);
  });

  it('passes through unmatched surrogates', () => {
    expect(deserialize('ab\ud801c')).toEqual([
      { type: 'text', children: ['ab\ud801c'] },
    ]);
    expect(deserialize('ab\udc37c')).toEqual([
      { type: 'text', children: ['ab\udc37c'] },
    ]);
  });

  it('drops unrecognized special characters', () => {
    expect(deserialize('ab\u{105A17}c')).toEqual([
      { type: 'text', children: ['abc'] },
    ]);
    expect(deserialize('abc\u{105A17}')).toEqual([
      { type: 'text', children: ['abc'] },
    ]);
    expect(deserialize('\u{105A17}abc')).toEqual([
      { type: 'text', children: ['abc'] },
    ]);
    expect(deserialize('\u{105A10}\u{105A17}a\u{105A11}abc\u{105A1C}')).toEqual(
      [
        {
          type: 'text',
          children: [{ type: 'text', styles: ['a'], children: ['abc'] }],
        },
      ]
    );
  });

  it('ignores all but the first specified custom inline type', () => {
    expect(deserialize('abc􅨐!r:せん.だい􅨝!ruby:yer􅨑def􅨜ghi')).toEqual([
      {
        type: 'text',
        children: [
          'abc',
          {
            type: 'r',
            styles: [],
            children: ['def'],
            data: 'せん.だい',
          },
          'ghi',
        ],
      },
    ]);
  });

  it('parses multiple blocks', () => {
    // Simple case
    expect(deserialize('abc\ndef')).toEqual([
      { type: 'text', children: ['abc'] },
      { type: 'text', children: ['def'] },
    ]);
    // Empty end block
    expect(deserialize('abc\n')).toEqual([
      { type: 'text', children: ['abc'] },
      { type: 'text', children: [] },
    ]);
    // Empty start block
    expect(deserialize('\nabc')).toEqual([
      { type: 'text', children: [] },
      { type: 'text', children: ['abc'] },
    ]);
    // Empty inner block
    expect(deserialize('abc\n\ndef')).toEqual([
      { type: 'text', children: ['abc'] },
      { type: 'text', children: [] },
      { type: 'text', children: ['def'] },
    ]);
    // Block delimeter only
    expect(deserialize('\n')).toEqual([
      { type: 'text', children: [] },
      { type: 'text', children: [] },
    ]);
  });
});
