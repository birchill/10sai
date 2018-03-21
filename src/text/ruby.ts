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
// * Anki markup++
//
//   e.g.  漢字[かん.じ]
//
//   * . separates ruby components
//   * as with でんでんマークダウン you need to have the same number of reading
//     components as base characters or else it gets treated as group ruby
//   * if the reading component matches the base text it is dropped
//     e.g. 創り出す[つく.り.だ.す] will only show ruby above the two kanji
//     characters [possibly not needed]
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
//
// Comparing the options:
//
// Group ruby:
//
//  Anki:       奥行[おくゆ]きの 錯覚[さっかく]を 創[つく]り 出[だ]す
//  でんでん:  {奥行|おくゆ}きの{錯覚|さっかく}を{創|つく}り{出|だ}す
//  Anki++:    奥行[おくゆ]きの錯覚[さっかく]を創[つく]り出[だ]す
//
// Multi ruby:
//
//  Anki:       奥[おく] 行[ゆ]きの 錯[さっ] 覚[かく]を 創[つく]り 出[だ]す
//  でんでん:  {奥行|おく|ゆ}きの{錯覚|さっ|かく}を{創|つく}り{出|だ}す
//  Anki++:    奥行き[おく.ゆ.き]の錯覚[さっ.かく]を 創り出す[つく.り.だ.す]
//   -or-      奥行き[おく.ゆ.]の錯覚[さっ.かく]を 創り出す[つく..だ.]
//   -or-      奥行[おく.ゆ]きの錯覚[さっ.かく]を創[つく]り出[だ]す
//
// After (mostly) implementing Anki++ I abandoned it because:
//
// - there was too much magic
// - there were too often conflicts with clozes that would confuse users (myself
//   included!)

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
    (matches = remainder.match(
      /(^|[^\\]){((?:\\.|[^\\{}|])+?)\|((?:\\.|[^{}])*?[^\\])}/
    ))
  ) {
    let leadingText = remainder.substr(0, matches.index!) + matches[1];
    if (leadingText.length) {
      result.push(leadingText);
    }

    result.push({
      base: matches[2],
      ruby: matches[3],
    });

    remainder = remainder.substr(matches.index! + matches[0].length);
  }

  if (remainder.length) {
    result.push(remainder);
  }

  // Strip any escape sequences from brackets
  const stripEscapes = (text: string) =>
    text
      .replace('\\{', '{')
      .replace('\\}', '}')
      .replace('\\|', '|');

  return result.map(piece => {
    if (typeof piece === 'string') {
      return stripEscapes(piece);
    } else {
      return { base: stripEscapes(piece.base), ruby: stripEscapes(piece.ruby) };
    }
  });
}

export function stripRuby(text: string): string {
  return parseRuby(text)
    .map(piece => (typeof piece === 'string' ? piece : piece.base))
    .join('');
}
