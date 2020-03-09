import * as React from 'react';

import { Card } from '../model';
import { NoteState } from '../notes/reducer';
import { QueuedCard } from '../review/reducer';
import { getReviewInterval } from '../review/utils';
import { hasNoModifiers, isTextBox } from '../utils/keyboard';
import { Overwrite } from '../utils/type-helpers';
import {
  cancelIdleCallback,
  requestIdleCallback,
} from '../utils/request-idle-callback';

import { DynamicNoteList } from './DynamicNoteList';
import { FailButton } from './FailButton';
import { OverlayTooltip } from './OverlayTooltip';
import { PassButton } from './PassButton';
import { ReviewCard } from './ReviewCard';

type QueuedActualCard = Overwrite<QueuedCard, { card: Card }>;

interface Props {
  active: boolean;
  className?: string;
  onShowBack: () => void;
  onPassCard: (options: { confidence: number }) => void;
  onFailCard: () => void;
  onEditCard: (id: string) => void;
  onNavigateBack: () => void;
  onNavigateForward: () => void;
  previousCard?: QueuedActualCard;
  currentCard: QueuedActualCard;
  nextCard?: QueuedActualCard;
  notes: Array<NoteState>;
}

export interface ReviewPanelInterface {
  focus: () => void;
}

type PanelDimensions = {
  width: number;
  height: number;
};

export const ReviewPanelImpl: React.ForwardRefRenderFunction<
  ReviewPanelInterface,
  Props
> = (props: Props, ref) => {
  const cardsRef = React.useRef<HTMLDivElement>(null);
  const passButtonRef = React.useRef<HTMLButtonElement>(null);
  const failButtonRef = React.useRef<HTMLButtonElement>(null);

  // focus() method
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

  // We listen for 'Enter' keyup events and use them to show the back or mark
  // a card as correct. However, if the user uses 'Enter' to click a button
  // we'll still get a keyup event in addition to the click event but we
  // probably want to ignore the keyup event in that case.
  //
  // Unfortunately that's a bit hard to detect since the keyup event doesn't
  // fire until after the click event has fired and the corresponding state has
  // been updated.
  //
  // Instead we simply set a flag whenever we get a click event that appears to
  // be from the keyboard.
  //
  // Note that this currently only actually happens when the user tabs to the
  // pass/fail button, then presses Enter. In other cases, we clear the focus
  // from the button so that it doesn't happen.
  const skipNextKeyUp = React.useRef<boolean>(false);
  const clickHandler = React.useCallback((e: MouseEvent) => {
    if (e.screenX === 0 && e.screenY === 0) {
      skipNextKeyUp.current = true;
    }
  }, []);
  React.useEffect(() => {
    document.documentElement.addEventListener('click', clickHandler);
    return () => {
      document.documentElement.removeEventListener('click', clickHandler);
    };
  }, [clickHandler]);

  // We also use the above flag when the component is first loaded to ensure we
  // ignore the keyup resulting from clicking the "New Review" button if any.
  React.useEffect(() => {
    skipNextKeyUp.current = true;
    const handle = requestIdleCallback(
      () => {
        skipNextKeyUp.current = false;
      },
      { timeout: 500 }
    );
    return () => {
      cancelIdleCallback(handle);
    };
  }, []);

  // We use keyup simply so that if the user holds down Enter too long they
  // don't end up passing all the cards accidentally.
  const keyUpHandler = React.useCallback(
    (e: KeyboardEvent) => {
      const shouldSkip = skipNextKeyUp.current;

      // It's important we clear this before any of the early returns because
      // we set it unconditionally on any click event should we should clear it
      // unconditionally on any keyup event.
      skipNextKeyUp.current = false;

      if (!props.active || e.defaultPrevented || shouldSkip) {
        return;
      }

      if (isTextBox(e.target)) {
        return;
      }

      if (
        props.currentCard.status === 'front' &&
        (e.key === 'Enter' || e.key === ' ')
      ) {
        props.onShowBack();
        e.preventDefault();
      } else if (hasNoModifiers(e)) {
        switch (e.key) {
          case 'e':
            props.onEditCard(props.currentCard.card.id);
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

          case 'ArrowLeft':
            props.onNavigateBack();
            break;

          case 'ArrowRight':
            props.onNavigateForward();
            break;

          default:
            // Don't call preventDefault
            return;
        }
        e.preventDefault();
      }
    },
    [
      props.active,
      props.currentCard.status,
      props.onShowBack,
      props.onEditCard,
      props.onFailCard,
      props.onPassCard,
      props.onNavigateBack,
      props.onNavigateForward,
    ]
  );

  React.useEffect(() => {
    document.documentElement.addEventListener('keyup', keyUpHandler);
    return () => {
      document.documentElement.removeEventListener('keyup', keyUpHandler);
    };
  }, [keyUpHandler]);

  // Clear focus from answer buttons when hiding them or simply when changing
  // cards.
  React.useEffect(() => {
    if (
      document.activeElement &&
      (document.activeElement === failButtonRef.current ||
        document.activeElement === passButtonRef.current)
    ) {
      // Try to focus the wrapper element so that, for example, when it becomes
      // scrollable (e.g. when displaying notes), you can use space to scroll
      // it.
      if (cardsRef.current) {
        cardsRef.current.focus();
      } else {
        (document.activeElement as HTMLElement).blur();
      }
    }
  }, [props.currentCard.status]);

  // Review interval tooltip
  const [tooltip, setTooltip] = React.useState<string>('');
  const [tooltipHidden, setTooltipHidden] = React.useState<boolean>(true);
  const onPassButtonDrag = React.useCallback(
    (confidence: number) => {
      setTooltip(
        getReviewIntervalString({
          queuedCard: props.currentCard,
          confidence,
        })
      );
      setTooltipHidden(false);
    },
    [props.currentCard]
  );
  const onPassButtonDragEnd = React.useCallback(() => {
    setTooltipHidden(true);
  }, []);

  // Record actual panel dimensions
  const reviewPanelRef = React.useRef<HTMLDivElement>(null);
  const [panelDimensions, setPanelDimensions] = React.useState<PanelDimensions>(
    { width: 0, height: 0 }
  );
  const resizeCallback = React.useCallback(() => {
    if (reviewPanelRef.current) {
      const { width, height } = reviewPanelRef.current.getBoundingClientRect();
      setPanelDimensions({ width, height });
    }
  }, [reviewPanelRef.current]);
  React.useLayoutEffect(() => {
    resizeCallback();
    window.addEventListener('resize', resizeCallback);
    return () => {
      window.removeEventListener('resize', resizeCallback);
    };
  }, [resizeCallback]);

  const showBack = props.currentCard.status !== 'front';

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

  const renderReviewCard = (
    queuedCard: QueuedActualCard,
    position: 'previous' | 'current' | 'next',
    onClick?: () => void
  ) => {
    const { card, status } = queuedCard;
    const reviewStatus =
      status === 'passed' || status === 'failed' ? status : undefined;
    return (
      <div
        className={`cardwrapper ${position}`}
        key={getUniqueKey(card.id)}
        onClick={onClick}
      >
        <ReviewCard
          showBack={status !== 'front'}
          reviewStatus={reviewStatus}
          due={card.progress.due}
          {...card}
        />
      </div>
    );
  };

  const currentCard = renderReviewCard(
    props.currentCard,
    'current',
    showBack ? undefined : props.onShowBack
  );

  let nextCard;
  if (props.nextCard) {
    nextCard = renderReviewCard(props.nextCard, 'next');
  }

  let previousCard;
  if (props.previousCard) {
    previousCard = renderReviewCard(props.previousCard, 'previous');
  }

  const answerButtons = (
    <div className="answer-buttons" hidden={!showBack}>
      <FailButton
        hidden={!showBack}
        onFailCard={props.onFailCard}
        ref={failButtonRef}
      />
      <PassButton
        hidden={!showBack}
        onDrag={onPassButtonDrag}
        onDragEnd={onPassButtonDragEnd}
        onPassCard={props.onPassCard}
        panelDimensions={panelDimensions}
        ref={passButtonRef}
      />
    </div>
  );

  return (
    <div
      className={`review-panel ${props.className || ''}`}
      ref={reviewPanelRef}
    >
      <div className="cards" ref={cardsRef} tabIndex={0}>
        {previousCard}
        {currentCard}
        {nextCard}
      </div>
      {showBack ? (
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
            keywords={props.currentCard.card.keywords}
            priority="reading"
            className="notes"
          />
        </>
      ) : null}
      {answerButtons}
      <OverlayTooltip hidden={tooltipHidden} text={tooltip} />
    </div>
  );
};

function getReviewIntervalString({
  queuedCard,
  confidence,
}: {
  queuedCard: QueuedActualCard;
  confidence: number;
}): string {
  const progressToUse = queuedCard.previousProgress || queuedCard.card.progress;

  const reviewInterval = getReviewInterval({
    card: { ...queuedCard.card, progress: progressToUse },
    confidence,
    reviewTime: new Date(),
  });

  if (reviewInterval < 2) {
    return `Next review in ${Math.round(reviewInterval * 24)} hours`;
  } else {
    return `Next review in ${Math.round(reviewInterval)} days`;
  }
}

export const ReviewPanel = React.forwardRef<ReviewPanelInterface, Props>(
  ReviewPanelImpl
);
