import React from 'react';
import PropTypes from 'prop-types';
import * as Immutable from 'immutable';

import {
  convertFromRaw,
  convertToRaw,
  ContentState,
  Editor,
  EditorState,
  Modifier,
  RichUtils,
  SelectionState,
} from 'draft-js';
import { cardKeyBindings } from '../text/key-bindings';
import { deserialize, serialize } from '../text/rich-text';
import { ColorKeywordOrBlack, ColorKeywords } from '../text/rich-text-styles';
import { fromDraft, toDraft } from '../text/draft-conversion';
import { setsEqual } from '../utils/sets-equal';

function serializeContent(editorState: EditorState): string {
  return serialize(fromDraft(convertToRaw(editorState.getCurrentContent())));
}

function deserializeContent(text: string): ContentState {
  return text === ''
    ? ContentState.createFromText('')
    : convertFromRaw(toDraft(deserialize(text)));
}

interface Props {
  initialValue?: string;
  className?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  onSelectionChange?: (collapsed: boolean) => void;
  onMarksUpdated?: (currentMarks: Set<string>) => void;
}

interface State {
  editorState: EditorState;
  previousInitialValue?: string;
  selectionToRestore: SelectionState | null;
  selectionHighlight: SelectionHighlight;
  hasFocus: boolean;
}

const styleMap: any = {
  EMPHASIS: {
    textEmphasis: 'dot',
    WebkitTextEmphasis: 'dot',
  },
  SELECTION: {
    backgroundColor: 'var(--selection-bg)',
  },
};

for (const color of ColorKeywords) {
  styleMap[`COLOR:${color}`] = { color: `var(--text-${color})` };
}

export type MarkType = 'bold' | 'italic' | 'underline' | 'emphasis';

// We store the current style as an Immutable.OrderedSet since it makes
// comparing with changes cheap but we return a standard ES6 Set, lowercased
// since:
//
// - We don't want to force consumers to use Immutable (10sai doesn't currently
//   use Immutable anywhere else)
// - The interface here is in terms of lowercase strings (e.g. toggleMark takes
//   lowercase strings)
const toMarkSet = (input: Immutable.OrderedSet<string>): Set<string> =>
  new Set<string>(
    input
      .toArray()
      .filter(style => !style.startsWith('COLOR:'))
      .map(style => style.toLowerCase())
  );

// This monster is the results of days and days of infuriating work to get
// draft-js to:
//
// - Preserve selections when tabbing between card faces but not when clicking
//   between them
// - To update the selection based on where the mouse is clicked
// - To render the selected range when the card is not focussed so that when
//   you're tabbing through formatting controls or interacting with controls
//   that steal focus (like a color picker) you still know what range you're
//   dealing with.
//
const enum SelectionHighlight {
  // The range is not highlighted using the SELECTION style (e.g. it is in
  // focus),
  None,
  // The range is highlighted (and mostly likely blurred)
  Highlighted,
  // The face has been focussed using the mouse so we're doing this complex
  // dance where we let the selection be updated before we clear the formatting
  // (so that we can capture and restore the selection after clearing the
  // formatting).
  //
  // This is the first stage of said dance where we've got the focus event but
  // the select event hasn't run yet.
  AwaitingSelectionUpdate,
  // The second stage of the above-mentioned dance where we've now got the
  // select event so draft will update the selection to match the DOM state.
  // We need to wait for that to be committed so we can read it back and
  // then restore it after clearing the selection formatting.
  AwaitingSelectionCommit,
}

export class CardFaceInput extends React.PureComponent<Props, State> {
  static get propTypes() {
    return {
      initialValue: PropTypes.string,
      className: PropTypes.string,
      placeholder: PropTypes.string,
      onChange: PropTypes.func,
      onSelectionChange: PropTypes.func,
      onMarksUpdated: PropTypes.func,
    };
  }

  static clearSelectionFormatting(editorState: EditorState): EditorState {
    const currentContent = editorState.getCurrentContent();
    const firstBlock = currentContent.getBlockMap().first();
    const lastBlock = currentContent.getBlockMap().last();
    const firstBlockKey = firstBlock.getKey();
    const lastBlockKey = lastBlock.getKey();
    const lengthOfLastBlock = lastBlock.getLength();

    const selectAll = new SelectionState({
      anchorKey: firstBlockKey,
      anchorOffset: 0,
      focusKey: lastBlockKey,
      focusOffset: lengthOfLastBlock,
      hasFocus: true,
    });
    const newContent = Modifier.removeInlineStyle(
      currentContent,
      selectAll,
      'SELECTION'
    );

    let updatedState = EditorState.push(
      editorState,
      newContent,
      'change-inline-style'
    );
    updatedState = EditorState.acceptSelection(
      updatedState,
      editorState.getSelection()
    );

    return updatedState;
  }

  state: State;
  editorRef: React.RefObject<Editor>;
  containerRef: React.RefObject<HTMLDivElement>;

  constructor(props: Props) {
    super(props);

    this.state = {
      editorState: EditorState.createEmpty(),
      selectionToRestore: null,
      selectionHighlight: SelectionHighlight.None,
      hasFocus: false,
    };
    this.editorRef = React.createRef<Editor>();
    this.containerRef = React.createRef<HTMLDivElement>();

    this.handleChange = this.handleChange.bind(this);
    this.handleFocus = this.handleFocus.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.handleKeyCommand = this.handleKeyCommand.bind(this);
    this.handleContainerMouseDown = this.handleContainerMouseDown.bind(this);
    this.handleContainerClick = this.handleContainerClick.bind(this);
    this.handleContainerSelect = this.handleContainerSelect.bind(this);
  }

  handleChange(editorState: EditorState) {
    const areSelectionEndpointsEqual = (
      a: SelectionState,
      b: SelectionState
    ): boolean =>
      a.get('anchorKey') === b.get('anchorKey') &&
      a.get('anchorOffset') === b.get('anchorOffset') &&
      a.get('focusKey') === b.get('focusKey') &&
      a.get('focusOffset') === b.get('focusOffset');

    if (
      this.props.onSelectionChange &&
      editorState.getSelection().getHasFocus() &&
      !areSelectionEndpointsEqual(
        editorState.getSelection(),
        this.state.editorState.getSelection()
      )
    ) {
      this.props.onSelectionChange(editorState.getSelection().isCollapsed());
    }

    if (this.props.onMarksUpdated) {
      const nextMarkSet = toMarkSet(editorState.getCurrentInlineStyle());
      const currentMarkSet = toMarkSet(
        this.state.editorState.getCurrentInlineStyle()
      );
      if (!setsEqual(nextMarkSet, currentMarkSet)) {
        this.props.onMarksUpdated(nextMarkSet);
      }
    }

    // We defer calling |onChange| until the state is actually updated so that
    // if that triggers a call to getDerivedStateFromProps we can successfully
    // recognize it as a redundant change and avoid re-setting the editor state.
    this.setState((prevState, props) => {
      if (props.onChange) {
        const valueAsString = serializeContent(editorState);
        if (valueAsString !== this.props.initialValue) {
          props.onChange(valueAsString);
        }
      }

      return { editorState };
    });
  }

  handleFocus() {
    // One of the "special features" of draft-js's onFocus / onBlur callbacks is
    // that you can't update editorState in them. Well, you can, but draft-js
    // will just clobber whatever changes you make. See the implementation of
    // editOnFocus and editOnBlur.
    //
    // As a result we do the update in the callback. That's all sorts of nasty,
    // but draft-js doesn't leave any other way.
    const selectionToRestore = this.state.selectionToRestore;
    this.setState({ hasFocus: true, selectionToRestore: null }, () => {
      if (selectionToRestore) {
        let editorState = CardFaceInput.clearSelectionFormatting(
          this.state.editorState
        );
        editorState = EditorState.forceSelection(
          editorState,
          selectionToRestore
        );
        this.setState({
          editorState,
          selectionHighlight: SelectionHighlight.None,
        });
      } else if (this.state.selectionHighlight !== SelectionHighlight.None) {
        this.setState({
          selectionHighlight: SelectionHighlight.AwaitingSelectionUpdate,
        });
      }
    });
  }

  handleBlur() {
    const stateChange: Partial<State> = { hasFocus: false };

    // draft-js unconditionally clears the selection on blur. It does this
    // because it figures that's how <textarea>s work. Except they don't.
    // Not when you use the keyboard. So we store the selection here
    // (by this point draft-js will have cleared the selection in the DOM but
    // _not_ in the editor state) so we can restore it when we are re-focussed.
    //
    // If we are re-focussed using the mouse / touch then we'll clear
    // |selectionToRestore| in handleContainerMouseDown below so that we don't
    // restore the selection.
    const selectionToRestore = this.state.editorState.getSelection();

    // See notes in onFocus for why we need to update editorState in a callback.
    this.setState({ hasFocus: false, selectionToRestore }, () => {
      // If we have a selection range, highlight it so we can see what we've
      // selected even when the focus is on the formatting toolbar.
      //
      // This is necessary when using the keyboard but also when adding complex
      // formatting widgets like color pickers that need to steal the focus.
      if (selectionToRestore && !selectionToRestore.isCollapsed()) {
        const newContent = Modifier.applyInlineStyle(
          this.state.editorState.getCurrentContent(),
          // We prefer this over using |selectionToRestore| since
          // |selectionToRestore| has hasFocus === true and if we set that then
          // we'll fail to run the onFocus callback later since draft-js will
          // thing the selection is already focussed.
          this.state.editorState.getSelection(),
          'SELECTION'
        );

        this.setState({
          editorState: EditorState.push(
            this.state.editorState,
            newContent,
            'change-inline-style'
          ),
          selectionHighlight: SelectionHighlight.Highlighted,
        });
      }
    });
  }

  handleKeyCommand(command: string, editorState: EditorState) {
    let newState: EditorState | null = RichUtils.handleKeyCommand(
      editorState,
      command
    );

    if (!newState) {
      switch (command) {
        case 'emphasis':
          newState = RichUtils.toggleInlineStyle(editorState, 'EMPHASIS');
          break;
      }
    }

    if (newState) {
      this.handleChange(newState);
      return 'handled';
    }
    return 'not-handled';
  }

  handleContainerMouseDown() {
    if (this.state.hasFocus) {
      return;
    }

    // This only gets called on a mouse click / touch in which case we should
    // clear the selection to restore since we only want to restore it when
    // tabbing between fields.
    if (this.state.selectionToRestore) {
      this.setState({ selectionToRestore: null });
    }

    // We can't clear the selection formatting here since that will change the
    // DOM and cause draft-js to think the area is no longer focussed. Instead
    // we clear it in onFocus.
  }

  handleContainerClick() {
    if (this.state.hasFocus) {
      return;
    }

    this.focus();
  }

  handleContainerSelect() {
    // See notes accompanying SelectionHighlight. Basically, we use this event
    // as a means of determining that draft-js should now have updated its
    // internal representation of the selection. We just need to wait for it to
    // render it so we can read it back (if we don't wait for it to render it,
    // we'll end rendering OUR selection, i.e. the one we use when clearing the
    // selection highlight, and we'll never be able to capture the DOM selection
    // that draft-js has extracted for us).
    if (
      this.state.selectionHighlight ===
      SelectionHighlight.AwaitingSelectionUpdate
    ) {
      this.setState({
        selectionHighlight: SelectionHighlight.AwaitingSelectionCommit,
      });
    }
  }

  focus() {
    if (this.editorRef.current) {
      this.editorRef.current.focus();
    }
    this.setState({ hasFocus: true });
  }

  collapseSelection() {
    if (this.state.selectionHighlight === SelectionHighlight.None) {
      return;
    }

    let editorState = this.state.editorState;

    editorState = CardFaceInput.clearSelectionFormatting(editorState);

    const selection = this.state.editorState.getSelection();
    const collapsedSelection: SelectionState = selection
      .set('focusKey', selection.getAnchorKey())
      .set('focusOffset', selection.getAnchorOffset()) as SelectionState;
    editorState = EditorState.acceptSelection(
      editorState,
      collapsedSelection.set('hasFocus', false) as SelectionState
    );
    this.setState({
      selectionToRestore: collapsedSelection,
      selectionHighlight: SelectionHighlight.None,
    });

    this.handleChange(editorState);
  }

  isSelectionCollapsed(): boolean {
    return this.state.editorState.getSelection().isCollapsed();
  }

  get element(): HTMLElement | null {
    return this.containerRef.current;
  }

  getCurrentMarks(): Set<string> {
    return toMarkSet(this.state.editorState.getCurrentInlineStyle());
  }

  toggleMark(type: MarkType) {
    this.handleChange(
      RichUtils.toggleInlineStyle(this.state.editorState, type.toUpperCase())
    );
  }

  setColor(color: ColorKeywordOrBlack) {
    const { editorState } = this.state;
    const selection = editorState.getSelection();

    const colorStyle = `COLOR:${color}`;

    // If selection is collapsed the toggle the inline style
    if (selection.isCollapsed()) {
      let nextOverrideStyle =
        editorState.getInlineStyleOverride() || Immutable.OrderedSet<string>();

      nextOverrideStyle = nextOverrideStyle.filter(
        style => !style!.startsWith('COLOR:')
      ) as Immutable.OrderedSet<string>;

      const hasColor = editorState.getCurrentInlineStyle().has(colorStyle);
      if (color !== 'black' && !hasColor) {
        nextOverrideStyle = nextOverrideStyle.add(colorStyle);
      }

      this.handleChange(
        EditorState.setInlineStyleOverride(editorState, nextOverrideStyle)
      );
      return;
    }

    // Drop any color styles in the range
    let nextContent = ColorKeywords.reduce(
      (contentState, color) =>
        Modifier.removeInlineStyle(contentState, selection, `COLOR:${color}`),
      editorState.getCurrentContent()
    );

    let nextEditorState = EditorState.push(
      editorState,
      nextContent,
      'change-inline-style'
    );

    // Set the new color (but only if it's not black)
    if (color !== 'black') {
      nextContent = Modifier.applyInlineStyle(
        nextContent,
        selection,
        colorStyle
      );

      nextEditorState = EditorState.push(
        nextEditorState,
        nextContent,
        'change-inline-style'
      );
    }

    this.handleChange(nextEditorState);
  }

  render() {
    const classes = [this.props.className, 'cardface-input'];
    if (this.state.hasFocus) {
      classes.push('hasFocus');
    }

    return (
      <div
        className={classes.join(' ')}
        onMouseDown={this.handleContainerMouseDown}
        onClick={this.handleContainerClick}
        onSelect={this.handleContainerSelect}
        ref={this.containerRef}
      >
        <Editor
          editorState={this.state.editorState}
          onChange={this.handleChange}
          onFocus={this.handleFocus}
          onBlur={this.handleBlur}
          handleKeyCommand={this.handleKeyCommand}
          customStyleMap={styleMap}
          keyBindingFn={cardKeyBindings}
          placeholder={this.props.placeholder}
          textAlignment="center"
          stripPastedStyles
          ref={this.editorRef}
        />
      </div>
    );
  }

  componentDidMount() {
    if (this.props.initialValue) {
      this.updateValueFromInitialValue();
    }
  }

  componentDidUpdate(prevProps: Props) {
    // If the initialValue was updated and our value hasn't deviated from it,
    // update our value to match it.
    if (
      prevProps.initialValue !== this.props.initialValue &&
      serializeContent(this.state.editorState) === prevProps.initialValue
    ) {
      this.updateValueFromInitialValue();
    }

    // Otherwise check if we need to swap the false selection for the real one.
    if (
      this.state.selectionHighlight ===
      SelectionHighlight.AwaitingSelectionCommit
    ) {
      this.swapInActiveSelection();
    }
  }

  updateValueFromInitialValue() {
    const stateChange: Partial<State> = { selectionToRestore: null };

    // We're about to update the value which means any selection we have may
    // start pointing to nodes that no longer exist it---we should clear it
    // otherwise we'll get errors.
    let editorState = this.state.editorState;
    if (this.state.selectionHighlight !== SelectionHighlight.None) {
      editorState = CardFaceInput.clearSelectionFormatting(editorState);
      stateChange.selectionHighlight = SelectionHighlight.None;
    }

    const contentState = deserializeContent(this.props.initialValue || '');
    editorState = EditorState.push(
      editorState,
      contentState,
      'insert-characters'
    );
    stateChange.editorState = editorState;

    this.setState(stateChange as State);
  }

  swapInActiveSelection() {
    const originalSelection = this.state.editorState.getSelection();

    let editorState = CardFaceInput.clearSelectionFormatting(
      this.state.editorState
    );
    editorState = EditorState.acceptSelection(editorState, originalSelection);

    this.setState({ editorState, selectionHighlight: SelectionHighlight.None });
  }
}

export default CardFaceInput;
