import * as React from 'react';

import { CardFaceInput, MarkType } from './CardFaceInput';
import {
  FormatToolbar,
  FormatButtonCommand,
  FormatButtonConfig,
  FormatButtonState,
} from './FormatToolbar';
import { ColorKeywordOrBlack } from '../text/rich-text-styles';
import {
  hasAllTheKeys,
  hasCommandModifierOnly,
  hasNoModifiers,
} from '../utils/keyboard';

import { Card } from '../model';
import { KeyboardFocusHelper } from '../utils/KeyboardFocusHelper';

interface Props {
  card: Partial<Card>;
  onChange?: (topic: 'front' | 'back', value: string | string[]) => void;
}

interface State {
  // Is the toolbar focussed?
  toolbarFocussed: boolean;

  // We track the "focussed" and "selected" face. The (quite subtle) difference
  // is:
  //
  // The focussed face is the face that actually has the focussed, if any. The
  // status of the toolbar icons should reflect this face, if set.
  //
  // The selected face is the face that the user most recently changed the
  // selection of.
  //
  // This distinction is needed (rather than just recording the last focussed
  // face) because when the user selects a range in the 'front' face then
  // navigates to the toolbar using Tab to pass _through_ the 'back' face on the
  // way there, the toolbar should still affect the 'front' face'.
  selectedFace: 'front' | 'back';
  focussedFace: 'front' | 'back' | null;

  currentMarks: Set<string>;
  hasSelection: boolean;
}

export class CardFaceEditControls extends React.Component<Props, State> {
  keyboardFocusHelper: KeyboardFocusHelper;

  frontTextBoxRef: React.RefObject<CardFaceInput>;
  backTextBoxRef: React.RefObject<CardFaceInput>;
  formatToolbarRef: React.RefObject<FormatToolbar>;

  handleFrontChange: (value: 'string') => void;
  handleBackChange: (value: 'string') => void;

  handleFrontMarksUpdated: (marks: Set<string>) => void;
  handleBackMarksUpdated: (marks: Set<string>) => void;

  handleFrontSelectionChange: () => void;
  handleBackSelectionChange: () => void;

  constructor(props: Props) {
    super(props);

    this.state = {
      toolbarFocussed: false,
      selectedFace: 'front',
      focussedFace: null,
      currentMarks: new Set<string>(),
      hasSelection: false,
    };

    this.keyboardFocusHelper = new KeyboardFocusHelper({
      onFocus: this.handleFocus.bind(this),
      onKeyDown: this.handleKeyDown.bind(this),
    });

    // Control refs
    this.frontTextBoxRef = React.createRef<CardFaceInput>();
    this.backTextBoxRef = React.createRef<CardFaceInput>();
    this.formatToolbarRef = React.createRef<FormatToolbar>();

    // Front text box handling
    this.handleFrontChange = this.handleTextBoxChange.bind(this, 'front');
    this.handleFrontSelectionChange = this.handleSelectionChange.bind(
      this,
      'front'
    );
    this.handleFrontMarksUpdated = this.handleMarksUpdated.bind(this, 'front');

    // Back text box handling
    this.handleBackChange = this.handleTextBoxChange.bind(this, 'back');
    this.handleBackSelectionChange = this.handleSelectionChange.bind(
      this,
      'back'
    );
    this.handleBackMarksUpdated = this.handleMarksUpdated.bind(this, 'back');

    // Formatting toolbar handling
    this.handleFormat = this.handleFormat.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
  }

  handleTextBoxChange(field: 'front' | 'back', value: string) {
    if (this.props.onChange) {
      this.props.onChange(field, value);
    }
  }

  handleSelectionChange(face: 'front' | 'back', collapsed: boolean) {
    if (this.state.focussedFace === face) {
      this.setState({ hasSelection: !collapsed });
    }

    // This is a bit tricky but we're specifically looking for the first time
    // the selection changes on the active face since that's what we use to
    // clear the selection range on the other face.
    //
    // For selection changes within the focussed face we rely on the
    // onMarksUpdated callback to be called.
    if (this.state.selectedFace === face || this.state.focussedFace !== face) {
      return;
    }

    this.updateSelectedFace(face);
  }

  updateSelectedFace(face: 'front' | 'back') {
    this.setState({ selectedFace: face });

    const otherFace =
      face === 'front'
        ? this.backTextBoxRef.current
        : this.frontTextBoxRef.current;
    if (otherFace) {
      otherFace.collapseSelection();
    }
  }

  handleMarksUpdated(face: 'front' | 'back', marks: Set<string>) {
    if (this.editFaceType !== face) {
      return;
    }

    this.setState({ currentMarks: marks });
  }

  get editFaceType(): 'front' | 'back' {
    // If we have a focussed face, use that. Otherwise use the selected face.
    //
    // This means that if, for example, the user selects a range in the
    // 'front', tabs to the back, then _clicks_ a button in the toolbar, the
    // command applies to the _back_ as one would expect.
    //
    // The only time it should apply to the selected face is if we don't have
    // a focussed face (e.g. we tabbed through to the toolbar).
    return this.state.focussedFace || this.state.selectedFace;
  }

  get editFace(): CardFaceInput | null {
    return this.editFaceType === 'front'
      ? this.frontTextBoxRef.current
      : this.backTextBoxRef.current;
  }

  get selectedFace(): CardFaceInput | null {
    return this.state.selectedFace === 'front'
      ? this.frontTextBoxRef.current
      : this.backTextBoxRef.current;
  }

  handleFormat(command: FormatButtonCommand, params?: ColorKeywordOrBlack) {
    if (!this.editFace) {
      return;
    }

    if (command === 'color') {
      if (params) {
        this.editFace.setColor(params);
      }
    } else if (command === 'cloze') {
      if (params) {
        this.makeCloze(params);
      }
    } else {
      this.editFace.toggleMark(command as MarkType);
    }
  }

  handleFocus(e: React.FocusEvent<{}> & { wasKeyboard: boolean }) {
    const stateChange: Partial<State> = {};

    // Check for a change of face
    let faceInFocus = false;
    const textboxes: Array<React.RefObject<CardFaceInput>> = [
      this.frontTextBoxRef,
      this.backTextBoxRef,
    ];
    for (const textbox of textboxes) {
      if (
        textbox.current &&
        textbox.current.element &&
        textbox.current.element.contains(e.target as HTMLElement)
      ) {
        faceInFocus = true;
        const face = textbox === this.frontTextBoxRef ? 'front' : 'back';
        if (this.state.focussedFace !== face) {
          stateChange.focussedFace = face;
          // If we are just tabbing through the field, we don't want to consider
          // that a change to the selected face. (We'll update that if the user
          // subsequently changes the selection within the newly-focussed face.)
          if (!e.wasKeyboard) {
            this.updateSelectedFace(face);
          }
          stateChange.currentMarks = textbox.current.getCurrentMarks();
          stateChange.hasSelection = !textbox.current.isSelectionCollapsed();
        }
        break;
      }
    }

    if (!faceInFocus) {
      stateChange.focussedFace = null;
      stateChange.toolbarFocussed = true;
      // Show the marks from the _selected_ face.
      if (this.selectedFace) {
        stateChange.currentMarks = this.selectedFace.getCurrentMarks();
        stateChange.hasSelection = !this.selectedFace.isSelectionCollapsed();
      }
    }

    this.setState(stateChange as State);
  }

  handleKeyDown(e: React.KeyboardEvent<{}>) {
    if (e.defaultPrevented) {
      return;
    }

    const isToggleColorKey = (e: React.KeyboardEvent<{}>): boolean =>
      (e.key === '/' && hasCommandModifierOnly(e)) ||
      (e.key === 'F7' && hasNoModifiers(e));
    const isSelectColorKey = (e: React.KeyboardEvent<{}>): boolean =>
      (e.key === '\\' && hasCommandModifierOnly(e)) ||
      (e.key === 'F8' && hasNoModifiers(e));

    if (this.formatToolbarRef.current && isToggleColorKey(e)) {
      this.formatToolbarRef.current.toggleColor();
      e.preventDefault();
    } else if (this.formatToolbarRef.current && isSelectColorKey(e)) {
      this.formatToolbarRef.current.selectColor();
      e.preventDefault();
      // Cloze shortcuts:
      //
      //  Ctrl+[
      //  Ctrl+Shift+Alt+C
      //
      // We'd like to include Ctrl+Shift+C like Anki does but we already use
      // Ctrl+Shift+C as our global "Add card" keystroke.
      //
      // Also, Anki supports Ctrl+Shift+Alt+C for adding clozes so hopefully
      // it's not too unfamiliar.
    } else if (
      (e.key === '[' && hasCommandModifierOnly(e)) ||
      (e.key === 'C' && hasAllTheKeys(e))
    ) {
      // XXX Pass in the actual color here... probably easier to do once we
      // store it.
      this.makeCloze('blue');
      e.preventDefault();
    }
  }

  handleBlur(e: React.FocusEvent<any>) {
    // Unconditionally clear focus state. We'll update it when we get the
    // subsequent focus event if necessary.
    this.setState({ toolbarFocussed: false, focussedFace: null });
  }

  makeCloze(color: ColorKeywordOrBlack) {
    if (
      !this.selectedFace ||
      !this.frontTextBoxRef.current ||
      !this.backTextBoxRef.current ||
      this.selectedFace.isSelectionCollapsed()
    ) {
      return;
    }

    const content = this.selectedFace.value;
    const selection = this.selectedFace.getSelection();

    this.frontTextBoxRef.current.makeCloze({
      color,
      selection,
      content,
      blank: true,
    });

    this.backTextBoxRef.current.makeCloze({
      color,
      selection,
      content,
      blank: false,
    });
  }

  get isFocussed(): boolean {
    return this.state.toolbarFocussed || !!this.state.focussedFace;
  }

  get formatButtonConfig(): Array<FormatButtonConfig> {
    let currentMarks: Set<string> | undefined;
    if (this.isFocussed) {
      currentMarks = this.state.currentMarks;
    }
    const hasMark = (style: string): boolean =>
      currentMarks ? currentMarks.has(style) : false;
    let hasSelection = this.isFocussed && this.state.hasSelection;

    const buttons: Array<FormatButtonConfig> = [
      {
        type: 'bold',
        label: 'Bold',
        accelerator: 'Ctrl+B',
        state: hasMark('bold')
          ? FormatButtonState.Set
          : FormatButtonState.Normal,
      },
      {
        type: 'italic',
        label: 'Italic',
        accelerator: 'Ctrl+I',
        state: hasMark('italic')
          ? FormatButtonState.Set
          : FormatButtonState.Normal,
      },
      {
        type: 'underline',
        label: 'Underline',
        accelerator: 'Ctrl+U',
        state: hasMark('underline')
          ? FormatButtonState.Set
          : FormatButtonState.Normal,
      },
      {
        type: 'emphasis',
        label: 'Dot emphasis',
        accelerator: 'Ctrl+.',
        state: hasMark('emphasis')
          ? FormatButtonState.Set
          : FormatButtonState.Normal,
      },
      {
        type: 'color',
        label: 'Text color',
        accelerator: 'Ctrl+/ or F7',
        state: FormatButtonState.Normal,
        initialColor: 'blue',
      },
      {
        type: 'color-dropdown',
        label: 'Select text color',
        accelerator: 'Ctrl+\\ or F8',
        state: FormatButtonState.Normal,
      },
      {
        type: 'cloze',
        label: 'Cloze',
        accelerator: 'Ctrl+[ or Ctrl+Shift+Alt+C',
        state: hasSelection
          ? FormatButtonState.Normal
          : FormatButtonState.Disabled,
        initialColor: 'blue',
      },
    ];

    return buttons;
  }

  render() {
    const classes = ['cardface-editcontrols'];
    if (this.state.toolbarFocussed) {
      classes.push('-toolbarfocus');
    }

    const getFaceClassName = (face: 'front' | 'back'): string => {
      const classes: Array<string> = [face];
      if (this.state.toolbarFocussed && this.state.selectedFace === face) {
        classes.push('-targeted');
      }
      return classes.join(' ');
    };

    return (
      <div
        className={classes.join(' ')}
        onFocus={this.keyboardFocusHelper.onFocus}
        onKeyDown={this.keyboardFocusHelper.onKeyDown}
        onBlur={this.handleBlur}
      >
        <CardFaceInput
          className={getFaceClassName('front')}
          initialValue={this.props.card.front || ''}
          placeholder="Front"
          onChange={this.handleFrontChange}
          onSelectionChange={this.handleFrontSelectionChange}
          onMarksUpdated={this.handleFrontMarksUpdated}
          ref={this.frontTextBoxRef}
        />
        <hr className="card-divider divider" />
        <CardFaceInput
          className={getFaceClassName('back')}
          initialValue={this.props.card.back || ''}
          placeholder="Back"
          onChange={this.handleBackChange}
          onSelectionChange={this.handleBackSelectionChange}
          onMarksUpdated={this.handleBackMarksUpdated}
          ref={this.backTextBoxRef}
        />
        <FormatToolbar
          className={'toolbar -center' + (this.isFocussed ? ' -areafocus' : '')}
          onClick={this.handleFormat}
          buttons={this.formatButtonConfig}
          ref={this.formatToolbarRef}
        />
      </div>
    );
  }

  focus() {
    // For the time being, focus() just means focus on the front
    this.frontTextBoxRef.current && this.frontTextBoxRef.current.focus();
  }
}
