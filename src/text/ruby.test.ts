import { stripRuby } from './ruby';

describe('stripRuby', () => {
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
