import { parseRuby, stripRuby } from './ruby';

describe('stripRuby', () => {
  // Helper to make expressing ruby results more compact.
  const ruby = (base: string, ruby: string) => ({ base, ruby });

  it('parses ruby', () => {
    // The basics
    expect(parseRuby('仙台')).toEqual(['仙台']);
    expect(parseRuby('{仙台|せんだい}')).toEqual([ruby('仙台', 'せんだい')]);
    expect(parseRuby(' {仙台|せんだい}')).toEqual([
      ' ',
      ruby('仙台', 'せんだい'),
    ]);
    expect(parseRuby('{{仙台|せんだい}')).toEqual([
      '{',
      ruby('仙台', 'せんだい'),
    ]);
    expect(parseRuby('{仙台|せんだい}}')).toEqual([
      ruby('仙台', 'せんだい'),
      '}',
    ]);
    expect(parseRuby('テスト{仙台|せんだい}')).toEqual([
      'テスト',
      ruby('仙台', 'せんだい'),
    ]);
    expect(parseRuby('テスト {仙台|せんだい}')).toEqual([
      'テスト ',
      ruby('仙台', 'せんだい'),
    ]);
    expect(parseRuby('{仙台|せんだい} ')).toEqual([
      ruby('仙台', 'せんだい'),
      ' ',
    ]);
    expect(parseRuby('テスト{仙台|せんだい}テスト')).toEqual([
      'テスト',
      ruby('仙台', 'せんだい'),
      'テスト',
    ]);
    expect(parseRuby('{仙台|せんだい}に{住|す}みたい')).toEqual([
      ruby('仙台', 'せんだい'),
      'に',
      ruby('住', 'す'),
      'みたい',
    ]);
    expect(
      parseRuby('{奥|おく}{行|ゆ}きの{錯覚|さっかく}を{創|つく}り{出|だ}す')
    ).toEqual([
      ruby('奥', 'おく'),
      ruby('行', 'ゆ'),
      'きの',
      ruby('錯覚', 'さっかく'),
      'を',
      ruby('創', 'つく'),
      'り',
      ruby('出', 'だ'),
      'す',
    ]);

    // Malformed content
    expect(parseRuby('{仙台}')).toEqual(['{仙台}']);
    expect(parseRuby('{仙台}|せんだい}')).toEqual(['{仙台}|せんだい}']);
    expect(parseRuby('{仙台|せんだい')).toEqual(['{仙台|せんだい']);
    expect(parseRuby('{|せんだい}')).toEqual(['{|せんだい}']);
    expect(parseRuby('仙台[せんだい')).toEqual(['仙台[せんだい']);
    expect(parseRuby('{仙台|せん{だい}')).toEqual(['{仙台|せん{だい}']);

    // Non-BMP codepoints
    expect(parseRuby('{🌊|うみ}')).toEqual([ruby('🌊', 'うみ')]);

    // Multi-ruby
    expect(parseRuby('{仙台|せん|だい}')).toEqual([
      ruby('仙', 'せん'),
      ruby('台', 'だい'),
    ]);
    // (Non-BMP base character)
    expect(parseRuby('{𠀡才|てん|さい}')).toEqual([
      ruby('𠀡', 'てん'),
      ruby('才', 'さい'),
    ]);

    // Multi-ruby with mismatched number of groups
    expect(parseRuby('{仙台|せん|だ|い}')).toEqual([ruby('仙台', 'せんだい')]);

    // Escaped brackets
    expect(parseRuby('\\{仙台|せんだい}')).toEqual(['{仙台|せんだい}']);
    expect(parseRuby('{仙台|せんだい\\}')).toEqual(['{仙台|せんだい}']);
    expect(parseRuby('{仙\\{台|せんだい}')).toEqual([
      ruby('仙{台', 'せんだい'),
    ]);
    expect(parseRuby('{仙台\\}|せんだい}')).toEqual([
      ruby('仙台}', 'せんだい'),
    ]);
    expect(parseRuby('{仙\\台|せんだい}')).toEqual([
      ruby('仙\\台', 'せんだい'),
    ]);
    expect(parseRuby('{仙台|せん\\{だい\\}}')).toEqual([
      ruby('仙台', 'せん{だい}'),
    ]);
    expect(parseRuby('{仙台|せん\\{だ\\}い}')).toEqual([
      ruby('仙台', 'せん{だ}い'),
    ]);
    expect(parseRuby('{仙台|せん\\だい}')).toEqual([
      ruby('仙台', 'せん\\だい'),
    ]);
    expect(parseRuby('\\{仙台}')).toEqual(['{仙台}']);
    expect(parseRuby('{仙台\\}')).toEqual(['{仙台}']);
    expect(parseRuby('\\{仙台\\}')).toEqual(['{仙台}']);

    // Escaped pipe
    expect(parseRuby('{仙台\\|せんだい}')).toEqual(['{仙台|せんだい}']);
    // TODO: More escaping here once we do multi-ruby
  });

  it('strips ruby', () => {
    expect(stripRuby('{仙台|せんだい}')).toEqual('仙台');
    expect(stripRuby('{仙台|せん|だい}')).toEqual('仙台');
    expect(stripRuby(' {仙台|せんだい}')).toEqual(' 仙台');
    expect(stripRuby('{仙台|せんだい} ')).toEqual('仙台 ');
    expect(stripRuby('{仙台|せんだい}に{住|す}みたい')).toEqual(
      '仙台に住みたい'
    );
    expect(stripRuby('{仙台|せんだい')).toEqual('{仙台|せんだい');
    expect(stripRuby('仙台せんだい}')).toEqual('仙台せんだい}');
    expect(stripRuby('{仙台|せんだい}}')).toEqual('仙台}');
    expect(stripRuby('仙台[.せんだい]')).toEqual('仙台[.せんだい]');
    expect(stripRuby('{🌊|うみ}に{住|す}みたい')).toEqual('🌊に住みたい');
  });
});
