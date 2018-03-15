// Survey of existing ruby markup shorthands:
//
// * Anki style: Space + Base[Reading]
//
//   i.e. ' ?([^ >]+?)\[(.+?)\]'
//   e.g. " 漢字[かんじ]", " 漢[かん] 字[じ]"
//   + ASCII only
//   + Familiar to anyone who knows Anki
//   + Easy to enter for group ruby (enter after kanji)
//   - Easy to get false positives, especially with clozes
//   - Is space as a separator a bit confusing? Is a user unfamiliar with the
//     difference between half-width and full-wdith spaces likely to be confused
//     if they enter a full-width space and it doesn't work?
//   - Hard to read
//   - Multi-ruby is cumbersome to enter
//
// * Some random markdown variant I found: [Base]{Reading}
//   (https://gist.github.com/aristotll/8f4b55b0503437e9b364)
//
//   i.e. '\[(.*?)\]\{(.*?)\}'
//   e.g. "[漢字]{かんじ}", "[漢]{かん}[字]{じ}"
//
//   + Unambiguous
//   + ASCII only
//   + Fairly easy to read
//   - Lots of characters to enter
//
// * でんでんマークダウン: {Base|Reading}
//   (https://conv.denshochan.com/markdown#ruby)
//   e.g. {漢字|かんじ} {漢字|かん|じ}
//
//   + ASCII only
//   + Includes various escape sequences and validation rules to avoid false
//     positives. The following all do *not* trigger ruby handling:
//       foo{|bar| bar.buz}
//       \{Info\|Warning\}
//       {Info\|Warning}
//       `{Info|Warning}`
//   + Shortcut for multi-ruby
//     (Probably only good for kanji but that's the main use case we care about
//     here anyway.)
//   + Includes online preview tool: https://edit.denshochan.com/
//   - A bit complicated
//   - Need to enter more characters than Anki-style
//   - Entering | on mobile devices is not always easy
//
// * Some other random approach I found: Base《Reading》
//   (http://www.aozora.gr.jp/annotation/etc.html#ruby)
//
//   e.g. 漢字《かんじ》
//   If your base text has all the same type of characters (e.g. all kanji, all
//   kana etc.) then it automatically detects the start of the base text.
//   Otherwise you need to mark off the start of the base text with a |.
//
//   + Auto-base start detection
//   + Fairly readable
//   - Japanese-specific
//   - Needs non-ASCII delimiter
//
// * Dictionary style (e.g. EDICT): Base 【Reading】
//
//   + Quite readable
//   + Less ambiguous
//   - Needs non-ASCII delimiter
//   - Not specified as a markup format per-se. No definition of how to mark off
//     the base text, etc.
//
// * A backwards-compatible extension of Anki to make it less ambiguous and
//   support group ruby?
//
//   e.g.  漢字[かん.じ]
//
//   * . separates ruby components
//   * as with でんでんマークダウン you need to have the same number of reading
//     components as base characters or else it gets treated as group ruby
//   * if the reading component matches the base text it is dropped
//     e.g. 創り出す[つく.り.だ.す] will only show ruby above the two kanji
//     characters [needed?]
//   * If the contents of [] begins with . it is not treated as ruby
//     to avoid confusion with clozes
//   * If the [ or ] is escaped with a \ it is not treated as ruby (as per
//     でんでんマークダウン)
//   * If the . is preceded by \ it is not treated as a multi-ruby text
//     separator
//   * The start of the base text is defined as the closest of:
//     - the start of the string
//     - a separator: half-width space, full-width space, punctuation (full or
//       half width), ]
//     - if the character preceding the [ is in one of the kanji ranges, the
//       first character before that which is not in that range.
//     e.g. "漢字[かんじ]" is accepted
//     e.g. "これは漢字[かんじ]" automatically detects the start of the base
//          text as 漢
//   * If there is a whitespace character before the [ the string is not
//     recognized as ruby.
//     e.g. "Det har været en virkelig hyggelig aften [Need to check spelling
//     here]" won't be recognized as ruby.
//   * We don't need Anki's special handling of '>' (presumably to avoid turning
//     "<i>[Citation needed]</i>" into ruby) since we don't expect to mix HTML
//     markup with our text although we might need some additional handling when
//     rich text formatting is involved.
//
// Comparing the options:
//
// Group ruby:
//
//  Anki:       奥行[おくゆ]きの 錯覚[さっかく]を 創[つく]り 出[だ]す
//  でんでん:  {奥行|おくゆ}きの{錯覚|さっかく}を{創|つく}り{出|だ}す
//  New thing: 奥行[おくゆ]きの錯覚[さっかく]を創[つく]り出[だ]す
//
// Multi ruby:
//
//  Anki:       奥[おく] 行[ゆ]きの 錯[さっ] 覚[かく]を 創[つく]り 出[だ]す
//  でんでん:  {奥行|おく|ゆ}きの{錯覚|さっ|かく}を{創|つく}り{出|だ}す
//  New thing: 奥行き[おく.ゆ.き]の錯覚[さっ.かく]を 創り出す[つく.り.だ.す]
//      -or-   奥行き[おく.ゆ.]の錯覚[さっ.かく]を 創り出す[つく..だ.]
//      -or-   奥行[おく.ゆ]きの錯覚[さっ.かく]を創[つく]り出[だ]す
//
// (Looking at the above, I wonder if the overlapping feature is really useful.
// It makes it easier to input, but harder, or at least longer, to read.)

interface RubyText {
  base: string;
  ruby: string;
}

type ParsedRuby = (RubyText | string)[];

export function parseRuby(text: string): ParsedRuby {
  const result = [];

  let remainder = text;
  let matches;
  while (
    remainder.length &&
    // For the punctuation we could try and match all the possible punctuation
    // characters, e.g.
    // https://www.fileformat.info/info/unicode/category/Po/list.htm
    // but that's likely to give some false positives. It's better to be
    // conservative. If we fail to match on something, the user can always add
    // a space to separate the base text. Furthermore, we primarily expect ruby
    // text to be used with CJK text so we only really need to worry about
    // punctuation used in those scripts.
    (matches = remainder.match(
      /([^\s\]。、！？；：・.,!?;:\/\\]+)\[((?:[^.].*?[^\\])|[^.\\])\]/
    ))
  ) {
    let leadingText = remainder.substr(0, matches.index!);

    // Drop any leading space (full- or half-width) used to separate the base
    // text.
    if (leadingText.endsWith(' ') || leadingText.endsWith('　')) {
      leadingText = leadingText.substr(0, leadingText.length - 1);
    }

    if (leadingText.length) {
      result.push(leadingText);
    }
    result.push({
      base: matches[1],
      ruby: matches[2],
    });

    remainder = remainder.substr(matches.index! + matches[0].length);
  }

  if (remainder.length) {
    result.push(remainder);
  }

  // Strip any escape sequences from brackets
  const stripEscapes = (text: string) =>
    text.replace('\\[', '[').replace('\\]', ']');

  return result.map(piece => {
    if (typeof piece === 'string') {
      return stripEscapes(piece);
    } else {
      return { base: stripEscapes(piece.base), ruby: stripEscapes(piece.ruby) };
    }
  });
}

export function stripRuby(text: string): string {
  // TODO: Rather than stripping the ruby, we should actually parse it and then
  // just collect together the base text and un-annotated text runs.
  return text;
}
