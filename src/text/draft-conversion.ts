import * as Immutable from 'immutable';

import {
  RawDraftContentState,
  RawDraftInlineStyleRange,
  RawDraftContentBlock,
  DraftInlineStyleType,
} from 'draft-js';
import unicodeSubstring from 'unicode-substring';

import { Block, Inline } from './rich-text';

const styleMappingFromDraft: { [key: string]: string } = {
  BOLD: 'b',
  ITALIC: 'i',
  UNDERLINE: 'u',
  EMPHASIS: '.',
};

const styleMappingToDraft: { [key: string]: string } = {};

for (const [key, value] of Object.entries(styleMappingFromDraft)) {
  styleMappingToDraft[value] = key;
}

function translateStyleFromDraft(style: string): string {
  if (style.startsWith('COLOR:')) {
    return 'c:' + style.substring('COLOR:'.length);
  }

  return styleMappingFromDraft.hasOwnProperty(style)
    ? styleMappingFromDraft[style]
    : style;
}

function translateStyleToDraft(style: string): string {
  if (style.startsWith('c:')) {
    return 'COLOR:' + style.substring(2);
  }

  return styleMappingToDraft.hasOwnProperty(style)
    ? styleMappingToDraft[style]
    : style;
}

export function fromDraft(content: RawDraftContentState): Array<Block> {
  const result: Array<Block> = [];

  for (const draftBlock of content.blocks) {
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
              style: translateStyleFromDraft(range.style),
            },
            {
              offset: range.offset + range.length,
              type: 'pop',
              style: translateStyleFromDraft(range.style),
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

export function toDraft(content: Array<Block>): RawDraftContentState {
  const result: RawDraftContentState = {
    blocks: [],
    entityMap: {},
  };

  for (const block of content) {
    const data: NodeData = convertNode(block, 0);

    const draftBlock: RawDraftContentBlock = {
      text: data.text,
      type: 'unstyled',
    };

    if (data.inlineStyles.length) {
      draftBlock.inlineStyleRanges = [];

      // Merge and add styles
      const rangeEnds: {
        [key: string]: { end: number; range: RawDraftInlineStyleRange };
      } = {};
      for (const styleRange of data.inlineStyles) {
        if (
          rangeEnds.hasOwnProperty(styleRange.style) &&
          rangeEnds[styleRange.style].end === styleRange.offset
        ) {
          rangeEnds[styleRange.style].range.length += styleRange.length;
          rangeEnds[styleRange.style].end += styleRange.length;
        } else {
          rangeEnds[styleRange.style] = {
            end: styleRange.offset + styleRange.length,
            range: styleRange,
          };
          draftBlock.inlineStyleRanges.push(styleRange);
        }
      }
    }

    result.blocks.push(draftBlock as Draft.RawDraftContentBlock);
  }

  return result;
}

interface NodeData {
  text: string;
  length: number;
  inlineStyles: Array<RawDraftInlineStyleRange>;
}

function convertNode(
  node: { styles?: Array<string>; children: Array<string | Inline> },
  offset: number
): NodeData {
  const inlineStyles: Array<RawDraftInlineStyleRange> = [];

  let text = '';
  let length = 0;
  for (const child of node.children) {
    if (typeof child === 'string') {
      text += child;
      length += [...child].length;
    } else {
      const data: NodeData = convertNode(child, offset + length);
      text += data.text;
      length += data.length;
      inlineStyles.push(...data.inlineStyles);
    }
  }

  if (node.styles) {
    // We know for certain that the inline styles that apply to this node will
    // have an offset <= than any we already have in inlineStyles so by adding
    // to the start of the array here, we can avoid sorting later.
    inlineStyles.unshift(
      ...node.styles.map(style => ({
        style: translateStyleToDraft(style) as DraftInlineStyleType,
        offset,
        length,
      }))
    );
  }

  return { text, length, inlineStyles };
}

// Within components that use Editor, we store the current style as an
// Immutable.OrderedSet since it makes comparing with changes cheap but we
// return a standard ES6 Set, lowercased since:
//
// - We don't want to force consumers of these components to use Immutable
//   (10sai doesn't currently use Immutable anywhere else)
// - The interface for thes components is in terms of lowercase strings (e.g.
//   toggleMark takes lowercase strings)
export const toMarkSet = (input: Immutable.OrderedSet<string>): Set<string> =>
  new Set<string>(
    input
      .toArray()
      .filter(style => !style.startsWith('COLOR:'))
      .map(style => style.toLowerCase())
  );
