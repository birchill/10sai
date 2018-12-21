import * as React from 'react';

import { hasNoModifiers, isTextBox } from '../utils/keyboard';

import { DynamicNoteList } from './DynamicNoteList';
import { ReviewCard } from './ReviewCard';
import { Card } from '../model';
import { NoteState } from '../notes/reducer';

interface Props {
  className?: string;
  showAnswer?: boolean;
  onShowAnswer: () => void;
  onPassCard: () => void;
  onFailCard: () => void;
  onEditCard: (id: string) => void;
  previousCard: Card;
  currentCard: Card;
  nextCard: Card;
  notes: Array<NoteState>;
}

export class ReviewPanel extends React.Component<Props> {
  passButtonRef: React.RefObject<HTMLButtonElement>;
  failButtonRef: React.RefObject<HTMLButtonElement>;
  cardsRef: React.RefObject<HTMLDivElement>;

  constructor(props: Props) {
    super(props);

    this.passButtonRef = React.createRef<HTMLButtonElement>();
    this.failButtonRef = React.createRef<HTMLButtonElement>();
    this.cardsRef = React.createRef<HTMLDivElement>();

    this.handleKeyUp = this.handleKeyUp.bind(this);
  }

  componentDidMount() {
    window.addEventListener('keyup', this.handleKeyUp);
  }

  componentWillUnmount() {
    window.removeEventListener('keyup', this.handleKeyUp);
  }

  componentDidUpdate(prevProps: Props) {
    // If we've hidden the answer buttons, we need to remove focus from them so
    // that you can't, for example, press 'Enter' and have them respond.
    if (
      prevProps.showAnswer &&
      !this.props.showAnswer &&
      document.activeElement &&
      (document.activeElement === this.failButtonRef.current ||
        document.activeElement === this.passButtonRef.current)
    ) {
      // Try to focus the wrapper element so that, for example, when it becomes
      // scrollable (e.g. when displaying notes), you can use space to scroll
      // it.
      if (this.cardsRef.current) {
        this.cardsRef.current.focus();
      } else {
        (document.activeElement as HTMLElement).blur();
      }
    }
  }

  // We use keyup simply so that if the user holds down Enter too long they
  // don't end up passing all the cards accidentally.
  //
  // TODO: Once we implement flipping back and forth using Space we should
  // probably use keydown for that.
  handleKeyUp(e: KeyboardEvent) {
    if (e.defaultPrevented) {
      return;
    }

    if (isTextBox(e.target)) {
      return;
    }

    // TODO: Eventually we should make space the key for flipping cards
    if (!this.props.showAnswer && (e.key === 'Enter' || e.key === ' ')) {
      this.props.onShowAnswer();
      e.preventDefault();
    } else if (hasNoModifiers(e)) {
      switch (e.key) {
        case 'e':
          this.props.onEditCard(this.props.currentCard.id);
          break;

        case 'x':
        case '1':
          this.props.onFailCard();

        case '3':
        case 'Enter':
          this.props.onPassCard();

        default:
          // Don't call preventDefault
          return;
      }
      e.preventDefault();
    }
  }

  render() {
    // There is one case where both the previous card and the next card might be
    // the same card (if the current card and previous card are the same we
    // remove the current card from the history). In that case we still need
    // unique keys for the two instances of the card or else React will complain
    // and fail to update the DOM correctly.
    //
    // Ideally, we still want to transition both so we want to maintain the
    // deduplicated keys for subsequent renders but that's quite messy. Instead,
    // We just take care to assign the undeduped ID to the *next* card so that
    // at least the card appears to transition from the right.
    const keysInUse = new Set<string>();

    const getUniqueKey = (key: string) => {
      let keyToTry: string = key;
      let index: number = 1;
      while (keysInUse.has(keyToTry)) {
        keyToTry = `${key}-${++index}`;
      }
      keysInUse.add(keyToTry);
      return keyToTry;
    };

    const currentCard = (
      <ReviewCard
        key={getUniqueKey(this.props.currentCard.id)}
        className="current"
        onShowAnswer={this.props.onShowAnswer}
        showAnswer={this.props.showAnswer}
        {...this.props.currentCard}
      />
    );

    let nextCard;
    if (this.props.nextCard) {
      nextCard = (
        <ReviewCard
          key={getUniqueKey(this.props.nextCard.id)}
          className="next"
          {...this.props.nextCard}
        />
      );
    }

    let previousCard;
    if (this.props.previousCard) {
      previousCard = (
        <ReviewCard
          key={getUniqueKey(this.props.previousCard.id)}
          className="previous"
          showAnswer
          {...this.props.previousCard}
        />
      );
    }

    const answerButtons = (
      <div className="answer-buttons" hidden={!this.props.showAnswer}>
        <button
          ref={this.failButtonRef}
          className="fail"
          aria-label="Incorrect"
          tabIndex={this.props.showAnswer ? 0 : -1}
          onClick={this.props.onFailCard}
        >
          <span className="buttonface">
            <svg className="icon" viewBox="0 0 100 100">
              <circle cx="15" cy="10" r="10" fill="white" />
              <circle cx="85" cy="10" r="10" fill="white" />
              <path
                d="M5 95a45 45 0 0 1 90 0"
                stroke="white"
                strokeWidth="10"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </span>
        </button>
        <button
          ref={this.passButtonRef}
          className="pass"
          aria-label="Correct"
          tabIndex={this.props.showAnswer ? 0 : -1}
          onClick={this.props.onPassCard}
        >
          <span className="buttonface">
            <svg className="icon" viewBox="0 0 100 100">
              <circle cx="15" cy="10" r="10" fill="white" />
              <circle cx="85" cy="10" r="10" fill="white" />
              <path
                d="M5 50a45 45 0 0 0 90 0"
                stroke="white"
                strokeWidth="10"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </span>
        </button>
      </div>
    );

    return (
      <div className={`review-panel ${this.props.className || ''}`}>
        <div className="cards" ref={this.cardsRef} tabIndex={0}>
          <div className="cardwrapper">
            {previousCard}
            {currentCard}
            {nextCard}
          </div>
          {this.props.showAnswer ? (
            <>
              <hr className="note-divider divider" />
              <DynamicNoteList
                noteListContext={{
                  screen: 'review',
                }}
                notes={this.props.notes}
                keywords={this.props.currentCard.keywords}
                priority="reading"
                className="notes"
              />
            </>
          ) : null}
        </div>
        {answerButtons}
      </div>
    );
  }
}
