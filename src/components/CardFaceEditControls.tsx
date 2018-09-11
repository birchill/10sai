import React from 'react';
import PropTypes from 'prop-types';

import { CardFaceInput } from './CardFaceInput';
import {
  CardFormatToolbar,
  FormatButtonCommand,
  FormatButtonConfig,
  FormatButtonState,
} from './CardFormatToolbar';

import { Card } from '../model';
import KeyboardFocusHelper from '../utils/KeyboardFocusHelper';

interface Props {
  card: Partial<Card>;
  onChange?: (topic: 'question' | 'answer', value: string | string[]) => void;
}

interface State {
  toolbarFocussed: boolean;

  // We track the "focussed" and "selected" face. The (quite subtle) difference
  // is:
  //
  // The focussed face is the face that is focussed. The status of the toolbar
  // icons should reflect this face, if set.
  //
  // The selected face is the face that the user most recently changed the
  // selection of.
  //
  // The main situation where the two differ is when the user selects a range in
  // the 'prompt' face, then tabs _through_ the 'answer' face to get to the
  // formatting toolbar. In this case, the 'prompt' face remains the selected
  // face but while tabbing through the 'answer' face it becomes the focussed
  // face and the toolbar's status should reflect that.
  selectedFace: 'prompt' | 'answer';
  focussedFace: 'prompt' | 'answer' | null;

  currentMarks: Set<string>;
}

export class CardFaceEditControls extends React.Component<Props, State> {
  static get propTypes() {
    return {
      card: PropTypes.object.isRequired,
      onChange: PropTypes.func,
    };
  }

  state: State = {
    toolbarFocussed: false,
    selectedFace: 'prompt',
    focussedFace: null,
    currentMarks: new Set<string>(),
  };

  keyboardFocusHelper: KeyboardFocusHelper;

  questionTextBoxRef: React.RefObject<CardFaceInput>;
  answerTextBoxRef: React.RefObject<CardFaceInput>;
  formatToolbarRef: React.RefObject<CardFormatToolbar>;

  handlePromptChange: (value: 'string') => void;
  handleAnswerChange: (value: 'string') => void;

  handlePromptMarksUpdated: (marks: Set<string>) => void;
  handleAnswerMarksUpdated: (marks: Set<string>) => void;

  handlePromptSelectionChange: () => void;
  handleAnswerSelectionChange: () => void;

  constructor(props: Props) {
    super(props);

    this.keyboardFocusHelper = new KeyboardFocusHelper({
      onFocus: this.handleFocus.bind(this),
    });

    // Control refs
    this.questionTextBoxRef = React.createRef<CardFaceInput>();
    this.answerTextBoxRef = React.createRef<CardFaceInput>();
    this.formatToolbarRef = React.createRef<CardFormatToolbar>();

    // Prompt text box handling
    this.handlePromptChange = this.handleTextBoxChange.bind(this, 'question');
    this.handlePromptSelectionChange = this.handleSelectionChange.bind(
      this,
      'prompt'
    );
    this.handlePromptMarksUpdated = this.handleMarksUpdated.bind(
      this,
      'prompt'
    );

    // Answer text box handling
    this.handleAnswerChange = this.handleTextBoxChange.bind(this, 'answer');
    this.handleAnswerSelectionChange = this.handleSelectionChange.bind(
      this,
      'answer'
    );
    this.handleAnswerMarksUpdated = this.handleMarksUpdated.bind(
      this,
      'answer'
    );

    // Formatting toolbar handling
    this.handleFormat = this.handleFormat.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
  }

  handleTextBoxChange(field: 'question' | 'answer', value: string) {
    if (this.props.onChange) {
      this.props.onChange(field, value);
    }
  }

  handleSelectionChange(face: 'prompt' | 'answer') {
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

  updateSelectedFace(face: 'prompt' | 'answer') {
    this.setState({ selectedFace: face });

    const otherFace =
      face === 'prompt'
        ? this.answerTextBoxRef.current
        : this.questionTextBoxRef.current;
    if (otherFace) {
      otherFace.collapseSelection();
    }
  }

  handleMarksUpdated(face: 'prompt' | 'answer', marks: Set<string>) {
    if (this.state.focussedFace !== face) {
      return;
    }

    this.setState({ currentMarks: marks });
  }

  get editFace(): CardFaceInput | null {
    // If we have a focussed face, use that. Otherwise use the selected face.
    //
    // This means that if, for example, the user selects a range in the
    // 'prompt', tabs to the answer, then _clicks_ a button in the toolbar, the
    // command applies to the _answer_ as one would expect.
    //
    // The only time it should apply to the selected face is if we don't have
    // a focussed face (e.g. we tabbed through to the toolbar).
    const face: 'prompt' | 'answer' =
      this.state.focussedFace || this.state.selectedFace;
    return face === 'prompt'
      ? this.questionTextBoxRef.current
      : this.answerTextBoxRef.current;
  }

  get selectedFace(): CardFaceInput | null {
    return this.state.selectedFace === 'prompt'
      ? this.questionTextBoxRef.current
      : this.answerTextBoxRef.current;
  }

  handleFormat(command: FormatButtonCommand) {
    if (!this.editFace) {
      return;
    }

    this.editFace.toggleMark(command);
  }

  handleFocus(e: React.FocusEvent<{}> & { wasKeyboard: boolean }) {
    const stateChange: Partial<State> = {};

    // Check for a change of face
    let faceInFocus = false;
    const textboxes: Array<React.RefObject<CardFaceInput>> = [
      this.questionTextBoxRef,
      this.answerTextBoxRef,
    ];
    for (const textbox of textboxes) {
      if (
        textbox.current &&
        textbox.current.element &&
        textbox.current.element.contains(e.target as HTMLElement)
      ) {
        faceInFocus = true;
        const face = textbox === this.questionTextBoxRef ? 'prompt' : 'answer';
        if (this.state.focussedFace !== face) {
          stateChange.focussedFace = face;
          // If we are just tabbing through the field, we don't want to consider
          // that a change to the selected face. (We'll update that if the user
          // subsequently changes the selection within the newly-focussed face.)
          if (!e.wasKeyboard) {
            this.updateSelectedFace(face);
          }
          stateChange.currentMarks = textbox.current.getCurrentMarks();
        }
        break;
      }
    }

    if (!faceInFocus) {
      stateChange.focussedFace = null;
      stateChange.toolbarFocussed = true;
      // If we tabbed to the toolbar but we have both a focussedFace and
      // a selectedFace, we should make sure we show the marks from the
      // _selected_ face.
      if (this.state.focussedFace && this.selectedFace) {
        stateChange.currentMarks = this.selectedFace.getCurrentMarks();
      }
    }

    this.setState(stateChange as State);
  }

  handleBlur(e: React.FocusEvent<any>) {
    // Unconditionally set this to false. We'll set it to true when we get he
    // subsequent focus event if necessary.
    this.setState({ toolbarFocussed: false });
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
    ];

    return buttons;
  }

  render() {
    const classes = ['cardface-editcontrols'];
    if (this.state.toolbarFocussed) {
      classes.push('-toolbarfocus');
    }

    const getFaceClassName = (face: 'prompt' | 'answer'): string => {
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
          className={getFaceClassName('prompt')}
          value={this.props.card.question || ''}
          placeholder="Prompt"
          onChange={this.handlePromptChange}
          onSelectionChange={this.handlePromptSelectionChange}
          onMarksUpdated={this.handlePromptMarksUpdated}
          ref={this.questionTextBoxRef}
        />
        <hr className="card-divider divider" />
        <CardFaceInput
          className={getFaceClassName('answer')}
          value={this.props.card.answer || ''}
          placeholder="Answer"
          onChange={this.handleAnswerChange}
          onSelectionChange={this.handleAnswerSelectionChange}
          onMarksUpdated={this.handleAnswerMarksUpdated}
          ref={this.answerTextBoxRef}
        />
        <CardFormatToolbar
          className={'toolbar -center' + (this.isFocussed ? ' -areafocus' : '')}
          onClick={this.handleFormat}
          buttons={this.formatButtonConfig}
          ref={this.formatToolbarRef}
        />
      </div>
    );
  }

  focus() {
    // For the time being, focus() just means focus on the question
    this.questionTextBoxRef.current && this.questionTextBoxRef.current.focus();
  }
}

export default CardFaceEditControls;
