import { extractKeywordsFromCloze } from './cloze';

describe('extractKeywordsFromCloze', () => {
  it('extracts keywords', () => {
    const tests = [
      ['仙台[..want to live..]', '仙台に住みたい', 'に住みたい'],
      ['仙台[..want to live..]。', '仙台に住みたい。', 'に住みたい'],
      ['[..capital of Miyage..]に住みたい', '仙台に住みたい', '仙台'],
      [
        '[..capital of Miyage..]に[..want to live..]',
        '仙台に住みたい',
        '仙台',
        '住みたい',
      ],
      ['[..capital of Miyage..]', '仙台', '仙台'],
      // Error cases
      ['仙台[..want to live..]', '仙台'],
      ['仙台に[..want to live..]', '仙台で生活したい'],
      // Partial-error case
      [
        '[..capital of Miyage..]に[..want to live..]。',
        '仙台に住みたい',
        '仙台',
      ],
    ];

    for (const test of tests) {
      expect(extractKeywordsFromCloze(test[0], test[1])).toEqual(test.slice(2));
    }
  });
});
