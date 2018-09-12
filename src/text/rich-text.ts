import { RawDraftContentState, RawDraftInlineStyleRange } from 'draft-js';
import unicodeSubstring from 'unicode-substring';

interface Block {
  type: 'text';
  children: Array<Inline | string>;
}

interface Inline {
  // This will be 'text' unless this represents an entity
  type: 'text' | string;
  // In Slate terms, these are marks
  styles: Array<string>;
  children: Array<Inline | string>;
  // Any data associted with the inline. Only set if type is NOT 'text'.
  data?: string;
}

type RichText = string;

export function serialize(text: Array<Block>): RichText {
  let result = '';
  let first = true;
  for (const block of text) {
    if (!first) {
      result += '\n';
    } else {
      first = false;
    }

    if (block.type === 'text') {
      result += serializeChildren(block.children);
    }
  }

  return result;
}

function serializeChildren(children: Array<Inline | string>): string {
  let result = '';
  for (const child of children) {
    if (typeof child === 'string') {
      result += sanitizeTextNode(child);
    } else if (typeof child === 'object') {
      result += serializeInline(child as Inline);
    }
  }
  return result;
}

const specialChar = /[\u{105A10}-\u{105AFF}]+/gu;

function sanitizeTextNode(text: string): string {
  return text.replace(specialChar, '').replace('\n', '\u{2028}');
}

const specialCharOrNewline = /[\u{105A10}-\u{105AFF}\n]+/gu;

function serializeInline(inline: Inline): string {
  // If the inline styles begin with '!' we can't serialize it without changing
  // meaning so it's safest to just throw in that case. Besides, it almost
  // certainly represents an application error, as opposed to user error, so
  // catestrophic failure is preferable.
  if (inline.styles.some(style => style.startsWith('!'))) {
    throw new Error('Failed to serialize. Style begins with a !');
  }

  // Likewise if the style name contains a special character of any kind--such
  // names are not user supplied, so any special character present represents an
  // application error.
  if (inline.styles.some(style => style.search(specialCharOrNewline) !== -1)) {
    throw new Error('Failed to serialize. Invalid character in style name.');
  }

  // Likewise for custom inline types
  if (inline.type.search(specialCharOrNewline) !== -1) {
    throw new Error('Failed to serialize. Invalid character in inline name.');
  }
  // (For inline data, however, it might be user supplied so we just strip
  // special characters when serializing.)

  let result = '\u{105A10}';
  const headers = [];
  if (inline.type !== 'text') {
    let header = `!${inline.type}`;
    // It's important we don't serialize the data if it's a zero-length string
    // since the parser will reject a custom inline header if the data string is
    // zero-length.
    if (inline.data && inline.data.length) {
      header += `:${inline.data.replace(specialCharOrNewline, '')}`;
    }
    headers.push(header);
  }
  headers.push(...inline.styles);
  result += headers.join('\u{105A1D}');
  result += '\u{105A11}';
  result += serializeChildren(inline.children);
  result += '\u{105A1C}';

  return result;
}

export function deserialize(text: RichText): Array<Block> {
  const result: Array<Block> = [];
  const parser = new Parser(text);
  for (const block of parser) {
    result.push(block);
  }
  return result;
}

const enum TokenType {
  Text,
  InlineRangeStart,
  InlineRangeHeaderDelimeter,
  InlineRangeHeaderEnd,
  InlineRangeEnd,
  BlockDelimeter,
}

type Token = {
  type: TokenType;
  offset: number;
  // Set (and non-zero length) if and only if type === TokenType.Text
  value?: string;
};

class Lexer implements Iterator<Token> {
  offset: number;
  input: string;
  len: number;
  nextToken: Token | null;

  constructor(input: string) {
    this.offset = 0;
    this.input = input;
    this.len = input.length;
    this.nextToken = null;
  }

  [Symbol.iterator]() {
    return this;
  }

  next(): IteratorResult<Token> {
    if (this.nextToken) {
      const nextToken = this.nextToken;
      this.nextToken = null;
      return { done: false, value: nextToken };
    }

    // Iterate through UTF-16 codepoints since this is faster in at least
    // Firefox, Chrome, and Edge.
    //
    // The fastest method, however, is to use a RegExp but in Edge you can get
    // these _massive_ performance cliffs with RegExps. Generally they're faster
    // but them sometimes that can take 10s of seconds. I have no idea why.
    // Also, the results in Edge can for RegExps can differ to other browsers.
    // In this and so many other way, Edge really is the new IE.
    let text = '';
    let startOffset = this.offset;
    for (; this.offset < this.len; this.offset++) {
      let thisToken: Token | undefined;
      const charCode = this.input.charCodeAt(this.offset);

      // Look for special characters
      if (charCode >= 0xd800 && charCode <= 0xdbff) {
        const codepoint = this.input.codePointAt(this.offset);
        if (codepoint && codepoint >= 0x105a10 && codepoint <= 0x105aff) {
          let type;
          switch (codepoint) {
            case 0x105a10:
              type = TokenType.InlineRangeStart;
              break;

            case 0x105a11:
              type = TokenType.InlineRangeHeaderEnd;
              break;

            case 0x105a1c:
              type = TokenType.InlineRangeEnd;
              break;

            case 0x105a1d:
              type = TokenType.InlineRangeHeaderDelimeter;
              break;

            default:
              // If we're encountering points in this range that we don't know
              // it's mostly likely future us. The best we can do is just drop
              // them and hope that future us has cleverly found a way to make
              // this work.
              //
              // Note that we _don't_ want to preserve these characters since
              // that might land us in a situation where there is content we can
              // read but not save back again.
              this.offset++;
              continue;
          }

          thisToken = { type, offset: this.offset };
          this.offset += 2;
        }
      } else if (charCode === 0xa) {
        thisToken = { type: TokenType.BlockDelimeter, offset: this.offset };
        this.offset++;
      } else if (charCode === 0x2028) {
        text += '\n';
        continue;
      }

      if (thisToken) {
        if (text.length) {
          this.nextToken = thisToken;
          return {
            done: false,
            value: {
              type: TokenType.Text,
              value: text,
              offset: startOffset,
            },
          };
        }

        return { done: false, value: thisToken };
      }

      text += this.input.substring(this.offset, this.offset + 1);
    }

    if (text.length) {
      return {
        done: false,
        value: {
          type: TokenType.Text,
          value: text,
          offset: startOffset,
        },
      };
    }

    // TS typings for IteratorResult don't currently allow value to be undefined
    // even though ES does.
    return { done: true } as IteratorResult<Token>;
  }
}

class Parser implements Iterator<Block> {
  private lexer: Lexer;
  private done: boolean;

  constructor(input: string) {
    this.lexer = new Lexer(input);
    // We set this to true because we have a slightly odd behavior where if the
    // content is an empty string, we want to return ZERO blocks (i.e. we want
    // to be able to represent a completely empty state). On the other hand, if
    // the content is a single block delimeter characters, we want to return TWO
    // blocks since that seems to best match the intention of the content.
    //
    // So we initially set |done| to true and if we get any content at all, we
    // set it to false until we hit the end of the content.
    this.done = true;
  }

  [Symbol.iterator]() {
    return this;
  }

  next(): IteratorResult<Block> {
    const block: Block = { type: 'text', children: [] };

    for (const token of this.lexer) {
      this.done = false;
      switch (token.type) {
        case TokenType.Text:
          block.children.push(token.value!);
          break;

        case TokenType.InlineRangeStart:
          block.children.push(this.consumeInline());
          break;

        case TokenType.BlockDelimeter:
          return { done: false, value: block };

        default:
          throw new Error(
            `Failed to parse '${this.lexer.input}'. Unexpected input at ${
              token.offset
            }`
          );
      }
    }

    if (!this.done) {
      this.done = true;
      return { done: false, value: block };
    }

    return { done: true } as IteratorResult<Block>;
  }

  consumeInline(): Inline {
    const result: Inline = { type: 'text', styles: [], children: [] };

    this.consumeInlineHeader(result);
    this.consumeInlineBody(result);

    return result;
  }

  consumeInlineHeader(inline: Inline) {
    for (const token of this.lexer) {
      switch (token.type) {
        case TokenType.Text:
          // Parse custom inline type
          if (token.value!.startsWith('!')) {
            // If we've already set an inline type just ignore any additional
            // ones. This is a speculative forwards-compatibility measure.
            //
            // For example, suppose in the future we introduce a new inline type
            // but we're afraid it will break older clients. We could handle
            // such a situation by extending this parser to record all the
            // specified types. Then in the markup we'd specify:
            //
            //   <old fallback type><delimeter><new type>
            //
            // Older versions of the client will ignore the new type based on
            // the following code while newer ones will be able to pick up the
            // new type.
            if (inline.type !== 'text') {
              continue;
            }
            const value = token.value!.substring(1);
            const colon = value.indexOf(':');
            if (!value.length || colon === 0 || colon === value.length - 1) {
              throw new Error(
                `Failed to parse '${
                  this.lexer.input
                }'. Malformed custom inline type at ${token.offset}`
              );
            }
            if (colon === -1) {
              inline.type = value;
            } else {
              inline.type = value.substring(0, colon);
              inline.data = value.substring(colon + 1);
            }
          } else {
            inline.styles.push(token.value!);
          }
          break;

        case TokenType.InlineRangeHeaderDelimeter:
          /* Ignore */
          break;

        case TokenType.InlineRangeHeaderEnd:
          return;

        default:
          throw new Error(
            `Failed to parse '${this.lexer.input}'. Unexpected token ${
              token.type
            } at ${token.offset}`
          );
      }
    }

    throw new Error(
      `Failed to parse '${
        this.lexer.input
      }'. Unexpected end of input parsing inline`
    );
  }

  consumeInlineBody(inline: Inline) {
    for (const token of this.lexer) {
      switch (token.type) {
        case TokenType.Text:
          inline.children.push(token.value!);
          break;

        case TokenType.InlineRangeEnd:
          return;

        case TokenType.InlineRangeStart:
          inline.children.push(this.consumeInline());
          break;

        default:
          throw new Error(
            `Failed to parse '${this.lexer.input}'. Unexpected token ${
              token.type
            } at ${token.offset}`
          );
      }
    }

    throw new Error(
      `Failed to parse '${
        this.lexer.input
      }'. Unexpected end of input parsing inline`
    );
  }
}

export function fromDraft(text: RawDraftContentState): Array<Block> {
  const result: Array<Block> = [];

  for (const draftBlock of text.blocks) {
    const block: Block = { type: 'text', children: [] };

    // So it turns out when I initially analzyed the data structures used by
    // Draft and Slate I didn't do a very good job and just assumed that Draft,
    // like Slate, doesn't allow overlapping (non-nested) ranges. It turns out
    // it does so this code is a bit complex. On the upside, converting this to
    // a hierarchical arrangement makes mapping to the DOM easier and will make
    // it easier to switch to Slate in the future should we decide to do so.
    const changeList = getChangeList(draftBlock.inlineStyleRanges);

    let offset: number = 0;
    const styleStack: Array<Inline> = [];
    const currentChildList = (): Array<string | Inline> =>
      styleStack.length
        ? styleStack[styleStack.length - 1].children
        : block.children;

    for (const change of changeList) {
      if (offset !== change.offset) {
        currentChildList().push(
          unicodeSubstring(draftBlock.text, offset, change.offset)
        );
      }

      const { pushStyles, popStyles } = change;
      while (popStyles.size) {
        if (!styleStack.length) {
          throw Error(
            'Something has gone horribly wrong in our range handling'
          );
        }
        const stackTop = styleStack.pop()!;
        for (const style of stackTop.styles) {
          if (popStyles.has(style)) {
            popStyles.delete(style);
          } else {
            // Any styles that we are popping but didn't want to, will need to
            // be re-added.
            pushStyles.add(style);
          }
        }
      }

      if (pushStyles.size) {
        const inline: Inline = {
          type: 'text',
          styles: [...pushStyles],
          children: [],
        };
        currentChildList().push(inline);
        styleStack.push(inline);
      }

      offset = change.offset;
    }

    if (offset !== draftBlock.text.length) {
      block.children.push(unicodeSubstring(draftBlock.text, offset));
    }

    result.push(block);
  }

  return result;
}

type ChangeList = {
  offset: number;
  pushStyles: Set<string>;
  popStyles: Set<string>;
};

function getChangeList(
  styleRanges: Array<RawDraftInlineStyleRange>
): Array<ChangeList> {
  type StyleChange = {
    offset: number;
    type: 'push' | 'pop';
    style: string;
  };

  const translateStyle = (style: string): string => {
    switch (style) {
      case 'BOLD':
        return 'b';

      case 'ITALIC':
        return 'i';

      case 'UNDERLINE':
        return 'u';

      case 'EMPHASIS':
        return '.';

      default:
        return style;
    }
  };

  return (
    styleRanges
      // Drop any SELECTION styles that show up
      .filter(
        (range: RawDraftInlineStyleRange): boolean =>
          (range.style as string) !== 'SELECTION'
      )
      // Convert each range into a push, pop command pair
      .map(
        (range: RawDraftInlineStyleRange): [StyleChange, StyleChange] => {
          return [
            {
              offset: range.offset,
              type: 'push',
              style: translateStyle(range.style),
            },
            {
              offset: range.offset + range.length,
              type: 'pop',
              style: translateStyle(range.style),
            },
          ];
        }
      )
      // Flatten the pairs
      .reduce(
        (
          previous: Array<StyleChange>,
          pair: [StyleChange, StyleChange]
        ): Array<StyleChange> => previous.concat(...pair),
        []
      )
      // Sort by offset
      .sort((a: StyleChange, b: StyleChange) => a.offset - b.offset)
      // Then group the commands together at each offset
      .reduce((previousList: Array<ChangeList>, change: StyleChange): Array<
        ChangeList
      > => {
        // Add a new entry if needed
        if (
          !previousList.length ||
          previousList[previousList.length - 1].offset !== change.offset
        ) {
          previousList.push({
            offset: change.offset,
            pushStyles: new Set<string>(),
            popStyles: new Set<string>(),
          });
        }

        const changeList = previousList[previousList.length - 1];
        if (change.type === 'push') {
          changeList.pushStyles.add(change.style);
        } else {
          changeList.popStyles.add(change.style);
        }

        return previousList;
      }, [])
  );
}

/*
function toDraft(text: Array<Block>): RawContentState {
  // XXX
}
*/

// This needs to be synchronized with the formatting applied in any editor
// components (e.g. draft-js, Slate etc.).
function toHTML(text: Array<Block>): string {
  // XXX
  return '';
}

function toPlainText(text: RichText): string {
  // XXX
  return '';
}
