import * as React from 'react';

import { hasNoModifiers, isTextBox } from '../utils/keyboard';

import { DynamicNoteList } from './DynamicNoteList';
import { ReviewCard } from './ReviewCard';
import { Card } from '../model';
import { NoteState } from '../notes/reducer';

interface Props {
  className?: string;
  showBack?: boolean;
  onShowBack: () => void;
  onPassCard: (options: { confidence: number }) => void;
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

    this.handleClickPass = this.handleClickPass.bind(this);
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
    //
    // NOTE: This might no longer be necessary now that ReviewScreen is calling
    // focus on us each time the review phase changes.
    if (
      prevProps.showBack &&
      !this.props.showBack &&
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

  handleClickPass(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    this.props.onPassCard({ confidence: 1 });
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
    if (!this.props.showBack && (e.key === 'Enter' || e.key === ' ')) {
      this.props.onShowBack();
      e.preventDefault();
    } else if (hasNoModifiers(e)) {
      switch (e.key) {
        case 'e':
          this.props.onEditCard(this.props.currentCard.id);
          break;

        case 'x':
        case '1':
          this.props.onFailCard();
          break;

        case '2':
          this.props.onPassCard({ confidence: 0.5 });
          break;

        case '3':
        case 'Enter':
          this.props.onPassCard({ confidence: 1 });
          break;

        case '4':
          this.props.onPassCard({ confidence: 2 });
          break;

        default:
          // Don't call preventDefault
          return;
      }
      e.preventDefault();
    }
  }

  focus() {
    if (this.cardsRef.current) {
      this.cardsRef.current.focus();
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
      <div
        className="cardwrapper"
        key={getUniqueKey(this.props.currentCard.id)}
      >
        <ReviewCard
          className="current"
          onShowBack={this.props.onShowBack}
          showBack={this.props.showBack}
          {...this.props.currentCard}
        />
      </div>
    );

    let nextCard;
    if (this.props.nextCard) {
      nextCard = (
        <div className="cardwrapper" key={getUniqueKey(this.props.nextCard.id)}>
          <ReviewCard className="next" {...this.props.nextCard} />
        </div>
      );
    }

    let previousCard;
    if (this.props.previousCard) {
      previousCard = (
        <div
          className="cardwrapper"
          key={getUniqueKey(this.props.previousCard.id)}
        >
          <ReviewCard
            className="previous"
            showBack
            {...this.props.previousCard}
          />
        </div>
      );
    }

    const answerButtons = (
      <div className="answer-buttons" hidden={!this.props.showBack}>
        <button
          ref={this.failButtonRef}
          className="fail"
          aria-label="Incorrect"
          tabIndex={this.props.showBack ? 0 : -1}
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
          tabIndex={this.props.showBack ? 0 : -1}
          onClick={this.handleClickPass}
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
          {previousCard}
          {currentCard}
          {nextCard}
        </div>
        {this.props.showBack ? (
          <DynamicNoteList
            noteListContext={{
              screen: 'review',
            }}
            notes={this.props.notes}
            keywords={this.props.currentCard.keywords}
            priority="reading"
            className="notes"
          />
        ) : null}
        {answerButtons}
      </div>
    );
  }
}
