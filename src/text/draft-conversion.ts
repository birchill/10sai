import { RawDraftContentState, RawDraftInlineStyleRange } from 'draft-js';
import unicodeSubstring from 'unicode-substring';

import { Block, Inline } from './rich-text';

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
