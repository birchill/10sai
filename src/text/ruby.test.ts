import { parseRuby, stripRuby } from './ruby';

describe('stripRuby', () => {
  // Helper to make expressing ruby results more compact.
  const ruby = (base: string, ruby: string) => ({ base, ruby });

  it('parses ruby', () => {
    // The basics
    expect(parseRuby('仙台')).toEqual(['仙台']);
    expect(parseRuby(' 仙台')).toEqual([' 仙台']);
    expect(parseRuby('　仙台')).toEqual(['　仙台']);
    expect(parseRuby('仙台 ')).toEqual(['仙台 ']);
    expect(parseRuby('仙台 [せんだい]')).toEqual(['仙台 [せんだい]']);
    expect(parseRuby('仙台[せんだい]')).toEqual([ruby('仙台', 'せんだい')]);
    expect(parseRuby(' 仙台[せんだい]')).toEqual([ruby('仙台', 'せんだい')]);
    expect(parseRuby('　仙台[せんだい]')).toEqual([ruby('仙台', 'せんだい')]);
    expect(parseRuby('  仙台[せんだい]')).toEqual([
      ' ',
      ruby('仙台', 'せんだい'),
    ]);
    expect(parseRuby('　　仙台[せんだい]')).toEqual([
      '　',
      ruby('仙台', 'せんだい'),
    ]);
    expect(parseRuby('　 仙台[せんだい]')).toEqual([
      '　',
      ruby('仙台', 'せんだい'),
    ]);
    expect(parseRuby('テスト 仙台[せんだい]')).toEqual([
      'テスト',
      ruby('仙台', 'せんだい'),
    ]);
    expect(parseRuby('テスト  仙台[せんだい]')).toEqual([
      'テスト ',
      ruby('仙台', 'せんだい'),
    ]);
    expect(parseRuby('テスト　仙台[せんだい]')).toEqual([
      'テスト',
      ruby('仙台', 'せんだい'),
    ]);
    expect(parseRuby('仙台[せんだい] ')).toEqual([
      ruby('仙台', 'せんだい'),
      ' ',
    ]);
    expect(parseRuby('テスト 仙台[せんだい]テスト')).toEqual([
      'テスト',
      ruby('仙台', 'せんだい'),
      'テスト',
    ]);
    expect(parseRuby('仙台[せんだい]に 住[す]みたい')).toEqual([
      ruby('仙台', 'せんだい'),
      'に',
      ruby('住', 'す'),
      'みたい',
    ]);

    // Cloze contents
    expect(parseRuby('仙台[..I want to live..]')).toEqual([
      '仙台[..I want to live..]',
    ]);

    // Preceding whitespace / punctuation
    // Malformed content
    // Escaped brackets
    // Non-BMP codepoints
    // Kanji boundary detection
    // Punctuation as separator
    // Multi-ruby
    // Multi-ruby with mismatched number of groups
    // Escaped multi-ruby
  });

  it('strips ruby', () => {
    /*
    expect(stripRuby('仙台[せんだい]')).toEqual('仙台');
    expect(stripRuby('仙台[せん.だい]')).toEqual('仙台');
    expect(stripRuby('仙台[せん|だい]')).toEqual('仙台');
    expect(stripRuby('仙台[せん｜だい]')).toEqual('仙台');
    expect(stripRuby(' 仙台[せんだい]')).toEqual('仙台');
    expect(stripRuby('  仙台[せんだい]')).toEqual(' 仙台');
    expect(stripRuby('　仙台[せんだい]')).toEqual('仙台');
    expect(stripRuby('仙台[せんだい]')).toEqual('仙台');
    expect(stripRuby('仙台[せんだい] ')).toEqual('仙台 ');
    expect(stripRuby('仙台[せんだい]に 住[す]みたい')).toEqual(
      '仙台に住みたい'
    );
    expect(stripRuby('仙台[せんだい')).toEqual('仙台[せんだい');
    expect(stripRuby('仙台せんだい]')).toEqual('仙台せんだい]');
    expect(stripRuby('仙台[せんだい]]')).toEqual('仙台]');
    expect(stripRuby('仙台[せんだい]')).toEqual('仙台[せんだい]');
    expect(stripRuby('仙台[せんだい]')).toEqual('仙台[せんだい]');
    expect(stripRuby('仙台[.せんだい]')).toEqual('仙台[.せんだい]');
    expect(stripRuby('仙台[せんだい.]')).toEqual('仙台[せんだい.]');
    expect(stripRuby('仙台[|せんだい]')).toEqual('仙台[|せんだい]');
    expect(stripRuby('仙台[せんだい|]')).toEqual('仙台[せんだい|]');
    expect(stripRuby('仙台[｜せんだい]')).toEqual('仙台[｜せんだい]');
    expect(stripRuby('仙台[せんだい｜]')).toEqual('仙台[せんだい｜]');
    expect(stripRuby('仙台[せんだい]に住[す]みたい')).toEqual(
      '仙台に住[す]みたい'
    );
    expect(stripRuby('仙台[せんだい]に[..want to live..]')).toEqual(
      '仙台に住[..want to live..]'
    );
    expect(stripRuby('🌊[うみ]に 住[す]みたい')).toEqual('🌊に住みたい');
     */
  });
});
