export const enum CharacterClass {
  Hiragana = 1 << 0,
  Katakana = 1 << 1,
  Kana = Hiragana | Katakana,
  Kanji = 1 << 2,
  HalfWidthKatakana = 1 << 3,
  Hentaigana = 1 << 4,
  _Max = 1 << 5,
}

export function matchesCharacterClasses(text: string, flags: number): boolean {
  if (flags < 0 || flags >= CharacterClass._Max) {
    throw new Error('Invalid character class');
  }

  // Treat an empty string as not matching anything
  if (!text.length) {
    return false;
  }

  return [...text].map(c => c.codePointAt(0)!).every(c => {
    if (
      flags & CharacterClass.Hiragana &&
      ((c >= 0x3040 && c <= 0x309f) || c === 0x1b001)
    ) {
      return true;
    }

    if (
      flags & CharacterClass.Katakana &&
      ((c >= 0x30a0 && c <= 0x30ff) ||
        (c >= 0x31f0 && c <= 0x31ff) ||
        c === 0x1b000)
    ) {
      return true;
    }

    if (
      flags & CharacterClass.Kanji &&
      ((c >= 0x4e00 && c <= 0x9fea) ||
      (c >= 0x3400 && c <= 0x4dbf) /* Ideographs extension A */ ||
        (c >= 0x20000 && c <= 0x2ebef)) /* Ideographs extension B&C&D&E */
    ) {
      return true;
    }

    if (
      flags & CharacterClass.HalfWidthKatakana &&
      (c >= 0xff65 && c <= 0xff9f)
    ) {
      return true;
    }

    if (flags & CharacterClass.Hentaigana && c >= 0x1b002 && c <= 0x1b0ff) {
      return true;
    }

    return false;
  });
}

export function isHiragana(text: string): boolean {
  return matchesCharacterClasses(text, CharacterClass.Hiragana);
}

export function isKatakana(text: string): boolean {
  return matchesCharacterClasses(text, CharacterClass.Katakana);
}

export function isKana(text: string): boolean {
  return matchesCharacterClasses(text, CharacterClass.Kana);
}

export function isKanji(text: string): boolean {
  return matchesCharacterClasses(text, CharacterClass.Kanji);
}

export function extractCharacterClasses(text: string, flags: number): string {
  if (flags < 0 || flags >= CharacterClass._Max) {
    throw new Error('Invalid character class');
  }

  return [...text].filter(c => matchesCharacterClasses(c, flags)).join('');
}

export function extractKanji(text: string): string {
  return extractCharacterClasses(text, CharacterClass.Kanji);
}
