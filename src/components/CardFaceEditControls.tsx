import React from 'react';
import PropTypes from 'prop-types';

import CardFaceInput from './CardFaceInput';
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
  isFocussed: boolean;

  // The active face is _not_ necessarily the focussed face _nor_ the most
  // recently focussed face.
  //
  // Because we have a single format toolbar that covers both faces, we need to
  // allow applying the formatting commands to the 'prompt' face using just the
  // keyboard (and without requiring the user to remember the keyboard
  // shortcuts). In other words, they may need to tab _through_ the 'answer'
  // face in order to get to the toolbar. As a result we try to detect the case
  // of a simple tab through a field using the keyboard and _don't_ update the
  // activeFace in that case.
  //
  // That might suggest our UX is just wrong, but all the other alternatives
  // I tried seem really clumsy particularly on small screens (screens which are
  // even smaller when you have an onscreen keyboard).
  activeFace: 'prompt' | 'answer';

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
    isFocussed: false,
    activeFace: 'prompt',
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

  get activeFace(): CardFaceInput | null {
    return this.state.activeFace === 'prompt'
      ? this.questionTextBoxRef.current
      : this.answerTextBoxRef.current;
  }

  handleTextBoxChange(field: 'question' | 'answer', value: string) {
    if (this.props.onChange) {
      this.props.onChange(field, value);
    }
  }

  handleSelectionChange(face: 'prompt' | 'answer') {
    if (this.state.activeFace === face) {
      return;
    }

    const stateChange: Partial<State> = { activeFace: face };
    const textBoxRef =
      face === 'prompt' ? this.questionTextBoxRef : this.answerTextBoxRef;
    if (textBoxRef.current) {
      stateChange.currentMarks = textBoxRef.current.getCurrentMarks();
    }
    this.setState(stateChange as State);
  }

  handleMarksUpdated(face: 'prompt' | 'answer', marks: Set<string>) {
    if (this.state.activeFace !== face) {
      return;
    }

    this.setState({ currentMarks: marks });
  }

  handleFormat(command: FormatButtonCommand) {
    if (!this.activeFace) {
      return;
    }

    this.activeFace.toggleMark(command);
  }

  handleFocus(e: React.FocusEvent<{}> & { wasKeyboard: boolean }) {
    const stateChange: Partial<State> = {
      isFocussed: true,
    };

    // Check for a change of face
    const textboxes: Array<React.RefObject<CardFaceInput>> = [
      this.questionTextBoxRef,
      this.answerTextBoxRef,
    ];
    for (const textbox of textboxes) {
      if (
        textbox.current &&
        textbox.current.element &&
        textbox.current.element.contains(e.target as HTMLElement) &&
        this.activeFace !== textbox.current &&
        // We ignore the change if it came from the keyboard since if we are
        // just tabbing through the field, we don't want to consider that
        // a change in which field is active.
        !e.wasKeyboard
      ) {
        stateChange.activeFace =
          textbox === this.questionTextBoxRef ? 'prompt' : 'answer';
        stateChange.currentMarks = textbox.current.getCurrentMarks();
        break;
      }
    }

    this.setState(stateChange as State);
  }

  handleBlur(e: React.FocusEvent<any>) {
    // Unconditionally set this to false. We'll set it to true when we get he
    // subsequent focus event if necessary.
    this.setState({ isFocussed: false });
  }

  get formatButtonConfig(): Array<FormatButtonConfig> {
    let currentMarks: Set<string> | undefined;
    if (this.state.isFocussed) {
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
    return (
      <div
        className="cardface-editcontrols"
        onFocus={this.keyboardFocusHelper.onFocus}
        onKeyDown={this.keyboardFocusHelper.onKeyDown}
        onBlur={this.handleBlur}
      >
        <CardFaceInput
          className="prompt"
          value={this.props.card.question || ''}
          placeholder="Prompt"
          onChange={this.handlePromptChange}
          onSelectionChange={this.handlePromptSelectionChange}
          onMarksUpdated={this.handlePromptMarksUpdated}
          ref={this.questionTextBoxRef}
        />
        <hr className="card-divider divider" />
        <CardFaceInput
          className="answer"
          value={this.props.card.answer || ''}
          placeholder="Answer"
          onChange={this.handleAnswerChange}
          onSelectionChange={this.handleAnswerSelectionChange}
          onMarksUpdated={this.handleAnswerMarksUpdated}
          ref={this.answerTextBoxRef}
        />
        <CardFormatToolbar
          className={
            'toolbar -center' + (this.state.isFocussed ? ' -areafocus' : '')
          }
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
