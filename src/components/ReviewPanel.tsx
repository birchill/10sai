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
import { OverlayTooltip } from './OverlayTooltip';
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

const enum ButtonDragStage {
  Idle,
  PreDrag,
  Dragging,
}

type ButtonDragOrigin = {
  x: number;
  y: number;
};

type ButtonDragState =
  | { stage: ButtonDragStage.Idle }
  | {
      stage: ButtonDragStage.PreDrag;
      origin: ButtonDragOrigin;
      timeout: number;
    }
  | { stage: ButtonDragStage.Dragging; origin: ButtonDragOrigin };

type PanelDimensions = {
  width: number;
  height: number;
  buttonFaceRadius: number;
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

  // Store various panel dimensions needed for the drag effect
  const reviewPanelRef = React.useRef<HTMLDivElement>(null);
  const [panelDimensions, setPanelDimensions] = React.useState<PanelDimensions>(
    { width: 0, height: 0, buttonFaceRadius: 0 }
  );
  const resizeCallback = React.useCallback(() => {
    if (reviewPanelRef.current) {
      const buttonFace = reviewPanelRef.current.querySelector(
        '.buttonface'
      ) as HTMLSpanElement;
      const { width, height } = reviewPanelRef.current.getBoundingClientRect();
      setPanelDimensions({
        width,
        height,
        buttonFaceRadius: parseFloat(getComputedStyle(buttonFace).width) / 2,
      });
    }
  }, [reviewPanelRef.current]);
  React.useLayoutEffect(() => {
    resizeCallback();
    window.addEventListener('resize', resizeCallback);
    return () => {
      window.removeEventListener('resize', resizeCallback);
    };
  }, [resizeCallback]);

  // Dragging effect for the pass button
  const [passDragState, setPassDragState] = React.useState<ButtonDragState>({
    stage: ButtonDragStage.Idle,
  });

  const cancelDrag = React.useCallback(() => {
    if (passButtonRef.current) {
      passButtonRef.current.style.transform = '';
      passButtonRef.current.style.filter = '';
      // Animate the reversing
      passButtonRef.current.style.transition = 'all 0.4s';

      // Revert the icon state too
      const icon = passButtonRef.current.querySelector('.icon') as SVGElement;
      icon.style.transform = '';
      icon.style.marginLeft = '';
      icon.style.transition = 'all 0.4s';
    }

    setPassDragState({ stage: ButtonDragStage.Idle });
  }, [passButtonRef.current]);

  const getDragMeasures = ({
    evt,
    dragOrigin,
    panelDimensions,
  }: {
    evt: PointerEvent;
    dragOrigin: ButtonDragOrigin;
    panelDimensions: PanelDimensions;
  }): {
    xDistance: number;
    yDistance: number;
    yPortion: number;
    confidence: number;
  } => {
    const xDistance = evt.clientX - dragOrigin.x;
    const yDistance = evt.clientY - dragOrigin.y;
    const yRange = panelDimensions.height || 100;
    const yPortion = Math.min(Math.max((yDistance * 2) / yRange, -1), 1);

    // For the confidence, we use linear interpolation for dragging down such
    // that the bottom extent is level 0 (and half-way is half the interval)
    // while when dragging up we use an exponential curve to allow a greater
    // range of values.
    const confidence = yPortion > 0 ? 1 - yPortion : Math.pow(16, -yPortion);

    return { xDistance, yDistance, yPortion, confidence };
  };

  const onPassPointerMove = React.useCallback(
    (evt: PointerEvent) => {
      if (passDragState.stage === ButtonDragStage.Idle) {
        return;
      }

      const { xDistance, yDistance, yPortion, confidence } = getDragMeasures({
        evt,
        dragOrigin: passDragState.origin,
        panelDimensions,
      });

      // If we are in the pre-dragging stage and the distance from the origin is
      // more than a few pixels, set the state to dragging.
      if (passDragState.stage === ButtonDragStage.PreDrag) {
        if (Math.sqrt(Math.pow(xDistance, 2) + Math.pow(yDistance, 2)) > 30) {
          clearTimeout(passDragState.timeout);
          setPassDragState({
            stage: ButtonDragStage.Dragging,
            origin: passDragState.origin,
          });
          setTooltip(
            getReviewIntervalString({
              queuedCard: props.currentCard,
              confidence,
            })
          );
        }
        return;
      }

      // If we are more than half way across the screen, cancel the action.
      if (xDistance < -panelDimensions.width / 2) {
        cancelDrag();
        return;
      }

      // Dragging state, update the tooltip.
      setTooltip(
        getReviewIntervalString({ queuedCard: props.currentCard, confidence })
      );

      if (!passButtonRef.current || !reviewPanelRef.current) {
        return;
      }

      passButtonRef.current.style.transform = `translate(${xDistance}px, ${yDistance}px)`;
      // Don't animate the dragging since Gecko seems to flicker when we do this
      passButtonRef.current.style.transitionProperty = 'none';

      // Make the color go red / blue based on the vertical position
      let hueRotateAngle;
      if (yPortion > 0) {
        hueRotateAngle = -yPortion * 120;
      } else {
        hueRotateAngle = -yPortion * 100;
      }
      passButtonRef.current.style.filter = `hue-rotate(${Math.round(
        hueRotateAngle
      )}deg)`;

      // Rotate or enlarge the icon accordingly
      const icon = passButtonRef.current.querySelector('.icon') as SVGElement;
      if (yPortion > 0) {
        icon.style.transform = `rotate(${180 * yPortion}deg)`;
      } else {
        icon.style.transform = `scale(${-2 * yPortion + 1})`;
      }
      // Likewise, don't transition this either
      icon.style.transitionProperty = 'none';

      // If we are dragging away from the left edge, move the thumb towards the
      // middle of the circle.
      if (xDistance < 0) {
        const marginLeft = Math.round(
          Math.min(-0.85 * panelDimensions.buttonFaceRadius - xDistance, 0)
        );
        icon.style.marginLeft = `${marginLeft}px`;
      } else {
        icon.style.marginLeft = '';
      }

      // If we are approaching the middle, fade the icon so we know it's about
      // to cancel.
      const quarterWidth = panelDimensions.width / 4;
      if (xDistance < -quarterWidth) {
        const fadeAmount = Math.min(
          (-xDistance - quarterWidth) / quarterWidth,
          1
        );
        const opacity = Math.round(100 * (1 - fadeAmount));
        passButtonRef.current.style.filter += ` opacity(${opacity}%)`;
      }
    },
    [
      passDragState.stage,
      (passDragState as any).origin,
      (passDragState as any).timeout,
      panelDimensions.height,
      props.currentCard,
      cancelDrag,
    ]
  );

  const onPassPointerUp = React.useCallback(
    (evt: PointerEvent) => {
      if (passDragState.stage === ButtonDragStage.PreDrag) {
        self.clearTimeout(passDragState.timeout);
      }

      if (passDragState.stage === ButtonDragStage.Dragging) {
        const { confidence } = getDragMeasures({
          evt,
          dragOrigin: passDragState.origin,
          panelDimensions,
        });
        props.onPassCard({ confidence });
      }

      cancelDrag();
    },
    [
      passDragState.stage,
      (passDragState as any).timeout,
      (passDragState as any).origin,
      panelDimensions,
      props.onPassCard,
      cancelDrag,
    ]
  );

  const onPassPointerCancel = React.useCallback(
    (evt: PointerEvent) => {
      if (passDragState.stage === ButtonDragStage.PreDrag) {
        self.clearTimeout(passDragState.timeout);
      }

      cancelDrag();
    },
    [passDragState.stage, (passDragState as any).timeout, cancelDrag]
  );

  React.useEffect(() => {
    if (passDragState.stage !== ButtonDragStage.Idle) {
      window.addEventListener('pointerup', onPassPointerUp);
      window.addEventListener('pointermove', onPassPointerMove);
      window.addEventListener('pointercancel', onPassPointerCancel);
    }
    return () => {
      window.removeEventListener('pointerup', onPassPointerUp);
      window.removeEventListener('pointermove', onPassPointerMove);
      window.removeEventListener('pointercancel', onPassPointerCancel);
    };
  }, [passDragState.stage, onPassPointerUp, onPassPointerMove]);

  const onPassPointerDown = React.useCallback(
    (evt: React.PointerEvent<HTMLButtonElement>) => {
      if (evt.button !== 0) {
        return;
      }

      if (props.currentCard.status === 'front') {
        return;
      }

      if (passDragState.stage !== ButtonDragStage.Idle) {
        console.error('Got pointer down while we are dragging?');
        return;
      }

      // Update to dragging state after a moment
      const origin = { x: evt.clientX, y: evt.clientY };
      const timeout = self.setTimeout(() => {
        setPassDragState({ stage: ButtonDragStage.Dragging, origin });
        setTooltip(
          getReviewIntervalString({
            queuedCard: props.currentCard,
            confidence: 1,
          })
        );
      }, 600);

      setPassDragState({ stage: ButtonDragStage.PreDrag, origin, timeout });
    },
    [passDragState.stage, props.currentCard.status, props.currentCard.card]
  );

  // We allow the pass button to be dragged around to vary the confidence level.
  // When the user releases it, we'll get a pointerup event and _sometimes_
  // a click event. The click event tends to be fired on desktop platforms but
  // not on mobile, although sometimes it is fired on mobile.
  //
  // We can't ignore the click event entirely, however, since it will be fired
  // when the user activates the pass button via the keyboard (pressing space
  // while it is focussed) or when we press the button without dragging it
  // (since we mostly ignore the event in that case).
  //
  // So we have a situation where we need to handle either case but NOT call
  // `onPassCard` twice when both events are fired.
  //
  // We originally tried to do that by setting an "ignoreClick" flag and
  // clearing it when we next showed the front of a card, but it turns out that
  // we would actually get the following sequence:
  //
  //   - Call onPassCard
  //   - Set ignoreClick = true
  //   - Re-render and reset ignoreClick and re-bind the onClick handler
  //   --> THEN the click event handler would fire (with ignoreClick = false).
  //
  // So instead we simply rely on the fact that there will be a re-render BEFORE
  // we run the click event handler so we can just check inside that handler if
  // we're showing the front of the card or not (and ignore the event if we
  // are).
  const onClickPass = React.useCallback(
    (evt: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      // Make sure we reset any dragging state in case we fail to get
      // a pointerup event.
      if (passDragState.stage === ButtonDragStage.PreDrag) {
        self.clearTimeout(passDragState.timeout);
      }
      if (passDragState.stage !== ButtonDragStage.Idle) {
        cancelDrag();
      }

      if (props.currentCard.status !== 'front') {
        props.onPassCard({ confidence: 1 });
      }
    },
    [
      passDragState.stage,
      cancelDrag,
      props.currentCard.status,
      props.onPassCard,
    ]
  );

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
      <button
        className="fail"
        aria-label="Incorrect"
        tabIndex={showBack ? 0 : -1}
        ref={failButtonRef}
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
        tabIndex={showBack ? 0 : -1}
        ref={passButtonRef}
        onClick={onClickPass}
        onPointerDown={onPassPointerDown}
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
      <OverlayTooltip
        hidden={passDragState.stage !== ButtonDragStage.Dragging}
        text={tooltip}
      />
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
