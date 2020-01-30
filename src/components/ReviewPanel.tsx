import * as React from 'react';

import { hasNoModifiers, isTextBox } from '../utils/keyboard';

import { DynamicNoteList } from './DynamicNoteList';
import { ReviewCard } from './ReviewCard';
import { Card } from '../model';
import { NoteState } from '../notes/reducer';

interface Props {
  active: boolean;
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

export interface ReviewPanelInterface {
  focus: () => void;
}

export const ReviewPanelImpl: React.FC<Props> = (props: Props, ref) => {
  const cardsRef = React.useRef<HTMLDivElement>(null);

  React.useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        if (!cardsRef.current) {
          return;
        }

        cardsRef.current.focus();
      },
    }),
    [cardsRef.current]
  );

  React.useEffect(() => {
    // We use keyup simply so that if the user holds down Enter too long they
    // don't end up passing all the cards accidentally.
    //
    // TODO: Once we implement flipping back and forth using Space we should
    // probably use keydown for that.
    const keyUpHandler = (e: KeyboardEvent) => {
      if (!props.active || e.defaultPrevented) {
        return;
      }

      if (isTextBox(e.target)) {
        return;
      }

      // TODO: Eventually we should make space the key for flipping cards
      if (!props.showBack && (e.key === 'Enter' || e.key === ' ')) {
        props.onShowBack();
        e.preventDefault();
      } else if (hasNoModifiers(e)) {
        switch (e.key) {
          case 'e':
            props.onEditCard(props.currentCard.id);
            break;

          case 'x':
          case '1':
            props.onFailCard();
            break;

          case '2':
            props.onPassCard({ confidence: 0.5 });
            break;

          case '3':
          case 'Enter':
            props.onPassCard({ confidence: 1 });
            break;

          case '4':
            props.onPassCard({ confidence: 2 });
            break;

          default:
            // Don't call preventDefault
            return;
        }
        e.preventDefault();
      }
    };

    document.documentElement.addEventListener('keyup', keyUpHandler);

    return () => {
      document.documentElement.removeEventListener('keyup', keyUpHandler);
    };
  }, [
    props.active,
    props.showBack,
    props.onShowBack,
    props.onEditCard,
    props.onFailCard,
    props.onPassCard,
  ]);

  const onClickPass = React.useCallback(
    (evt: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      props.onPassCard({ confidence: 1 });
    },
    [props.onPassCard]
  );

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
      className="cardwrapper current"
      key={getUniqueKey(props.currentCard.id)}
      onClick={props.onShowBack}
    >
      <ReviewCard showBack={props.showBack} {...props.currentCard} />
    </div>
  );

  let nextCard;
  if (props.nextCard) {
    nextCard = (
      <div className="cardwrapper next" key={getUniqueKey(props.nextCard.id)}>
        <ReviewCard {...props.nextCard} />
      </div>
    );
  }

  let previousCard;
  if (props.previousCard) {
    previousCard = (
      <div
        className="cardwrapper previous"
        key={getUniqueKey(props.previousCard.id)}
      >
        <ReviewCard showBack {...props.previousCard} />
      </div>
    );
  }

  const answerButtons = (
    <div className="answer-buttons" hidden={!props.showBack}>
      <button
        className="fail"
        aria-label="Incorrect"
        tabIndex={props.showBack ? 0 : -1}
        onClick={props.onFailCard}
      >
        <span className="buttonface">
          <svg className="icon" viewBox="0 0 100 100">
            <title>Fail</title>
            <use
              width="100"
              height="100"
              href="#thumbsup"
              fill="currentcolor"
              transform="rotate(180 50 50) translate(0 -10)"
            />
          </svg>
        </span>
      </button>
      <button
        className="pass"
        aria-label="Correct"
        tabIndex={props.showBack ? 0 : -1}
        onClick={onClickPass}
      >
        <span className="buttonface">
          <svg className="icon" viewBox="0 0 100 100">
            <title>Pass</title>
            <use
              width="100"
              height="100"
              href="#thumbsup"
              fill="currentcolor"
            />
          </svg>
        </span>
      </button>
    </div>
  );

  return (
    <div className={`review-panel ${props.className || ''}`}>
      <div className="cards" ref={cardsRef} tabIndex={0}>
        {previousCard}
        {currentCard}
        {nextCard}
      </div>
      {props.showBack ? (
        <>
          <div className="notes-header">
            <span className="line" />
            <span className="title">Notes</span>
            <span className="line" />
          </div>
          <DynamicNoteList
            noteListContext={{
              screen: 'review',
            }}
            notes={props.notes}
            keywords={props.currentCard.keywords}
            priority="reading"
            className="notes"
          />
        </>
      ) : null}
      {answerButtons}
    </div>
  );
};

export const ReviewPanel = React.forwardRef<ReviewPanelInterface, Props>(
  ReviewPanelImpl
);
