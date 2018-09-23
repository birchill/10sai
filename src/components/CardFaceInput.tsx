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
import { fromDraft, toDraft } from '../text/draft-conversion';

function serializeContent(editorState: EditorState): string {
  return serialize(fromDraft(convertToRaw(editorState.getCurrentContent())));
}

function deserializeContent(text: string): ContentState {
  return text === ''
    ? ContentState.createFromText('')
    : convertFromRaw(toDraft(deserialize(text)));
}

interface Props {
  value?: string;
  className?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  onSelectionChange?: () => void;
  onMarksUpdated?: (currentMarks: Set<string>) => void;
}

interface State {
  editorState: EditorState;
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
    color: 'var(--selection-color)',
  },
};

// We store the current style as an Immutable.OrderedSet since it makes
// comparing with changes cheap but we return a standard ES6 Set, lowercased
// since:
//
// - We don't want to force consumers to use Immutable (10sai doesn't currently
//   use Immutable anywhere else)
// - The interface here is in terms of lowercase strings (e.g. toggleMark takes
//   lowercase strings)
const toMarkSet = (input: Immutable.OrderedSet<string>): Set<string> =>
  new Set<string>(input.toArray().map(style => style.toLowerCase()));

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
      value: PropTypes.string,
      className: PropTypes.string,
      placeholder: PropTypes.string,
      onChange: PropTypes.func,
      onSelectionChange: PropTypes.func,
      onMarksUpdated: PropTypes.func,
    };
  }

  static getDerivedStateFromProps(props: Props, state: State): State | null {
    // In general the state is our single source of truth for the value of the
    // input. However, it would nice to reflect changes to the value made from
    // syncing. That preserves the promise of "sync you don't need to sink
    // about".
    //
    // However, when the user is typing fast there are async events flying all
    // over the shop (async state updates, async updates to Redux state that
    // trickles down on the next render, then updates triggered by updating the
    // database) and it's really hard to distinguish between genuine updates to
    // the Redux state (reflected in prop changes here) that we care about
    // versus delayed reactions to state changes we made here a few keystrokes
    // about. In fact, I tried a bunch of approaches but none of them worked.
    //
    // However, when you're focussed on the field you don't really want the
    // value to update anyway. Any updates that happen when the field is not
    // focussed are probably legitimate edits made on another device/tab/browser
    // that we should reflect.
    if (state.hasFocus) {
      return null;
    }

    // If the value in state already matches the props value, don't update.
    const currentValueInState = serializeContent(state.editorState);
    if (currentValueInState === props.value) {
      return null;
    }

    const stateChange: Partial<State> = { selectionToRestore: null };

    let editorState = state.editorState;
    if (state.selectionHighlight !== SelectionHighlight.None) {
      editorState = CardFaceInput.clearSelectionFormatting(editorState);
      stateChange.selectionHighlight = SelectionHighlight.None;
    }

    const contentState = deserializeContent(props.value || '');
    editorState = EditorState.push(
      editorState,
      contentState,
      'insert-characters'
    );
    stateChange.editorState = editorState;

    return stateChange as State;
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
      this.props.onSelectionChange();
    }

    if (this.props.onMarksUpdated) {
      const inlineStyle = editorState.getCurrentInlineStyle();
      const currentInlineStyle = this.state.editorState.getCurrentInlineStyle();
      if (!inlineStyle.equals(currentInlineStyle)) {
        this.props.onMarksUpdated(
          toMarkSet(editorState.getCurrentInlineStyle())
        );
      }
    }

    // We defer calling |onChange| until the state is actually updated so that
    // if that triggers a call to getDerivedStateFromProps we can successfully
    // recognize it as a redundant change and avoid re-setting the editor state.
    this.setState((prevState, props) => {
      if (props.onChange) {
        const valueAsString = serializeContent(editorState);
        if (valueAsString !== this.props.value) {
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

  get element(): HTMLElement | null {
    return this.containerRef.current;
  }

  getCurrentMarks(): Set<string> {
    return toMarkSet(this.state.editorState.getCurrentInlineStyle());
  }

  toggleMark(type: 'bold' | 'italic' | 'underline' | 'emphasis') {
    this.handleChange(
      RichUtils.toggleInlineStyle(this.state.editorState, type.toUpperCase())
    );
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

  componentDidUpdate() {
    if (
      this.state.selectionHighlight !==
      SelectionHighlight.AwaitingSelectionCommit
    ) {
      return;
    }

    const originalSelection = this.state.editorState.getSelection();

    let editorState = CardFaceInput.clearSelectionFormatting(
      this.state.editorState
    );
    editorState = EditorState.acceptSelection(editorState, originalSelection);

    this.setState({ editorState, selectionHighlight: SelectionHighlight.None });
  }
}

export default CardFaceInput;
