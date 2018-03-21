import {
  isHiragana,
  isKatakana,
  isKanji,
  extractKanji,
  matchesCharacterClasses,
  CharacterClass,
} from './japanese';

describe('character class checks', () => {
  it('recognizes hiragana', () => {
    expect(isHiragana('あ')).toEqual(true);
    expect(isHiragana('ひらがな')).toEqual(true);
    expect(isHiragana('Hiragana')).toEqual(false);
    expect(isHiragana('ヒラガナ')).toEqual(false);
    expect(isHiragana('平仮名')).toEqual(false);
    expect(isHiragana('ひらがな。')).toEqual(false);
  });

  it('recognizes katakana', () => {
    expect(isKatakana('ア')).toEqual(true);
    expect(isKatakana('カタカナ')).toEqual(true);
    expect(isKatakana('Katakana')).toEqual(false);
    expect(isKatakana('かたかな')).toEqual(false);
    expect(isKatakana('片仮名')).toEqual(false);
    expect(isKatakana('カタカナ。')).toEqual(false);
    expect(isKatakana('ｶﾀｶﾅ')).toEqual(false);
  });

  it('recognizes half-width katakana', () => {
    expect(
      matchesCharacterClasses('ｱ', CharacterClass.HalfWidthKatakana)
    ).toEqual(true);
    expect(
      matchesCharacterClasses('ｶﾀｶﾅ', CharacterClass.HalfWidthKatakana)
    ).toEqual(true);
    expect(
      matchesCharacterClasses('カタカナ', CharacterClass.HalfWidthKatakana)
    ).toEqual(false);
  });

  it('recognizes kanji', () => {
    expect(isKanji('字')).toEqual(true);
    expect(isKanji('漢字')).toEqual(true);
    expect(isKanji('かんじ')).toEqual(false);
    expect(isKanji('カンジ')).toEqual(false);
    expect(isKanji('Kanji')).toEqual(false);
    expect(isKanji('漢字。')).toEqual(false);
    expect(isKanji('𠁎')).toEqual(true);
  });

  it('allows combining classes', () => {
    expect(
      matchesCharacterClasses(
        '漢字マン',
        CharacterClass.Kanji | CharacterClass.Katakana
      )
    ).toEqual(true);
    expect(
      matchesCharacterClasses(
        '漢字だよ',
        CharacterClass.Kanji | CharacterClass.Katakana
      )
    ).toEqual(false);
  });
});

describe('character class extraction', () => {
  it('extracts kanji', () => {
    expect(extractKanji('漢字だけほしい。')).toEqual('漢字');
    expect(extractKanji('漢+字')).toEqual('漢字');
  });
});
