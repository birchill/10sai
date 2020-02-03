import * as React from 'react';

import { hasNoModifiers, isTextBox } from '../utils/keyboard';

import { DynamicNoteList } from './DynamicNoteList';
import { OverlayTooltip } from './OverlayTooltip';
import { ReviewCard } from './ReviewCard';
import { Card } from '../model';
import { NoteState } from '../notes/reducer';
import { getReviewInterval } from '../review/utils';

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

  const nextConfidence = React.useRef<number>(1);

  const onClickPass = React.useCallback(
    (evt: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      props.onPassCard({ confidence: nextConfidence.current });
      nextConfidence.current = 1;
    },
    [props.onPassCard, nextConfidence.current]
  );

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
  const passButtonRef = React.useRef<HTMLButtonElement>(null);
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
    const confidence = Math.pow(8, -yPortion);

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
            getReviewIntervalString({ card: props.currentCard, confidence })
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
        getReviewIntervalString({ card: props.currentCard, confidence })
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
        nextConfidence.current = confidence;
      }

      cancelDrag();
    },
    [
      passDragState.stage,
      (passDragState as any).origin,
      panelDimensions,
      cancelDrag,
    ]
  );

  React.useEffect(() => {
    if (passDragState.stage !== ButtonDragStage.Idle) {
      window.addEventListener('pointerup', onPassPointerUp);
      window.addEventListener('pointermove', onPassPointerMove);
    }
    return () => {
      window.removeEventListener('pointerup', onPassPointerUp);
      window.removeEventListener('pointermove', onPassPointerMove);
    };
  }, [passDragState.stage, onPassPointerUp, onPassPointerMove]);

  const onPassPointerDown = React.useCallback(
    (evt: React.PointerEvent<HTMLButtonElement>) => {
      if (evt.button !== 0) {
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
          getReviewIntervalString({ card: props.currentCard, confidence: 1 })
        );
      }, 600);

      setPassDragState({ stage: ButtonDragStage.PreDrag, origin, timeout });
    },
    [passDragState.stage]
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
      <OverlayTooltip
        hidden={passDragState.stage !== ButtonDragStage.Dragging}
        text={tooltip}
      />
    </div>
  );
};

function getReviewIntervalString({
  card,
  confidence,
}: {
  card: Card;
  confidence: number;
}): string {
  const reviewInterval = getReviewInterval({
    card,
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
