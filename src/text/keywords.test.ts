import { getKeywordVariants } from './keywords';

describe('keyword variants', () => {
  it('creates variants from kanji', () => {
    // String form
    expect(getKeywordVariants('')).toEqual([]);
    expect(getKeywordVariants(' ')).toEqual([]);
    expect(getKeywordVariants('abc')).toEqual([]);
    expect(getKeywordVariants('漢')).toEqual([]);
    expect(getKeywordVariants('漢字')).toEqual(['漢', '字']);
    expect(getKeywordVariants('カン字')).toEqual(['字']);
    expect(getKeywordVariants('日曜日')).toEqual(['日', '曜']);
    expect(getKeywordVariants('日曜日')).toEqual(['日', '曜']);
    expect(getKeywordVariants('仙𠁎台')).toEqual(['仙', '𠁎', '台']);

    // Array form
    expect(getKeywordVariants([])).toEqual([]);
    expect(getKeywordVariants([''])).toEqual([]);
    expect(getKeywordVariants([' '])).toEqual([]);
    expect(getKeywordVariants(['漢', '大'])).toEqual([]);
    expect(getKeywordVariants(['漢字', '大好き'])).toEqual([
      '漢',
      '字',
      '大',
      '好',
    ]);
    expect(getKeywordVariants(['漢字', '文字'])).toEqual(['漢', '字', '文']);
  });
});
