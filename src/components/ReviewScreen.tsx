import * as React from 'react';
import DocumentTitle from 'react-document-title';

import { ReviewPhase } from '../review/ReviewPhase';

import { Link } from './Link';
import { LoadingIndicator } from './LoadingIndicator';
import { ReviewPanelContainer } from './ReviewPanelContainer';
import { TricolorProgress } from './TricolorProgress';

interface ReviewProps {
  onNewReview: (maxNewCards: number, maxCards: number) => void;
  availableCards: {
    newCards: number;
    overdueCards: number;
  };
  maxNewCards: number;
  maxCards: number;
}

interface Props extends ReviewProps {
  active: boolean;
  phase: ReviewPhase;
  reviewProgress: {
    failedCardsLevel1: number;
    failedCardsLevel2: number;
    completedCards: number;
    unreviewedCards: number;
  };
}

const nextReviewNumCards = (props: ReviewProps): number => {
  return Math.min(
    Math.min(props.availableCards.newCards, props.maxNewCards) +
      props.availableCards.overdueCards,
    props.maxCards
  );
};

const ReviewButton: React.SFC<ReviewProps> = (props: ReviewProps) => {
  const numCards = nextReviewNumCards(props);
  return (
    <button
      className="button start -primary -center"
      onClick={() => {
        props.onNewReview(props.maxNewCards, props.maxCards);
      }}
    >
      {`New review (${numCards})`}
    </button>
  );
};

const renderTitle: React.SFC<Props> = (props: Props) => {
  if (!props.active) {
    return null;
  }

  let subtitle = 'Review';

  switch (props.phase) {
    case ReviewPhase.Loading:
      subtitle = 'Loading review...';
      break;

    case ReviewPhase.Loading:
      subtitle = 'Review complete';
      break;

    case ReviewPhase.Front:
    case ReviewPhase.Back:
      {
        const {
          failedCardsLevel1,
          failedCardsLevel2,
          completedCards,
          unreviewedCards,
        } = props.reviewProgress;

        const total =
          completedCards +
          unreviewedCards +
          failedCardsLevel1 +
          failedCardsLevel2;
        const complete = completedCards + failedCardsLevel1 * 0.5;
        const percentComplete = Math.round((complete / total) * 100);
        subtitle = `Review (${percentComplete}%)`;
      }
      break;
  }

  return <DocumentTitle title={`10sai - ${subtitle}`} />;
};

export const ReviewScreen: React.SFC<Props> = (props: Props) => {
  const settingsButton = (
    <Link href="/review/settings" className="settings-button">
      Settings
    </Link>
  );

  const pluralCards = (num: number) => (num === 1 ? 'card' : 'cards');

  const loading =
    props.phase === ReviewPhase.Loading ||
    ([ReviewPhase.Idle, ReviewPhase.Complete].includes(props.phase) &&
      !props.availableCards);

  let content: React.ReactNode;
  if (loading) {
    content = (
      <div className="content summary-panel">
        <div className="icon">
          <LoadingIndicator />
        </div>
      </div>
    );
  } else if (props.phase === ReviewPhase.Idle) {
    const numCards = nextReviewNumCards(props);
    if (numCards === 0) {
      content = (
        <div className="content summary-panel">
          <div className="icon -general -reviewfinished" />
          <h4 className="heading">No cards to review!</h4>
          <div className="details">
            <p>
              There are no cards that need to be reviewed at this time.
              You&rsquo;re all over this.
            </p>
          </div>
        </div>
      );
    } else {
      content = (
        <div className="content summary-panel">
          <div className="icon -general -review" />
          <h4 className="heading">Start a new review</h4>
          <div className="details">
            <p>
              The next review will include{' '}
              <strong>{`${numCards} ${pluralCards(numCards)}`}</strong>.
            </p>
            <p>
              You can adjust the number of cards to review from the{' '}
              <span className="icon -settings -grey" /> settings above.
            </p>
            <ReviewButton {...props} />
          </div>
        </div>
      );
    }
  } else if (props.phase === ReviewPhase.Complete) {
    // TODO: Stats here about review -- num cards reviewed, % correct on first
    // attempt.

    let nextReviewPrompt;
    const numCards = nextReviewNumCards(props);
    if (numCards !== 0) {
      const { newCards, overdueCards } = props.availableCards;
      let promptText;
      if (newCards > 0 && overdueCards > 0) {
        promptText = (
          <p>
            {newCards === 1 ? 'There is still ' : 'There are still '}
            <strong>
              {`${newCards} new ${pluralCards(newCards)}`}
            </strong> and{' '}
            <strong>
              {`${overdueCards} overdue ${pluralCards(overdueCards)}`}
            </strong>{' '}
            cards available to review.
          </p>
        );
      } else if (newCards > 0) {
        promptText = (
          <p>
            {newCards === 1 ? 'There is still ' : 'There are still '}
            <strong>{`${newCards} new ${pluralCards(newCards)}`}</strong>{' '}
            available to review.
          </p>
        );
      } else {
        promptText = (
          <p>
            {overdueCards === 1 ? 'There is still ' : 'There are still '}
            <strong>
              {`${overdueCards} overdue ${pluralCards(overdueCards)}`}
            </strong>{' '}
            available to review.
          </p>
        );
      }
      nextReviewPrompt = (
        <React.Fragment>
          {promptText}
          <ReviewButton {...props} />
        </React.Fragment>
      );
    }

    content = (
      <div className="content summary-panel">
        <div className="icon -general -reviewfinished" />
        <h4 className="heading">All done!</h4>
        <div className="details">{nextReviewPrompt}</div>
      </div>
    );
  } else {
    content = <ReviewPanelContainer className="content" />;
  }

  let progressBar;
  if (props.phase === ReviewPhase.Front || props.phase === ReviewPhase.Back) {
    // We want to roughly represent the number of reviews. Bear in mind that
    // a failed card will need to be reviewed twice before it is considered to
    // have passed.
    //
    // If we pass a card immediately, we treat that as passing two reviews since
    // effectively we skipped the two reviews we would do if we failed it.
    // Similarly, for unseen cards.
    const {
      failedCardsLevel1,
      failedCardsLevel2,
      completedCards,
      unreviewedCards,
    } = props.reviewProgress;
    const failCount = failedCardsLevel1 + failedCardsLevel2 * 2;
    const remaining = failCount + unreviewedCards;
    const title =
      remaining === 1 ? '1 review remaining' : `${remaining} reviews remaining`;
    progressBar = (
      <TricolorProgress
        className="progress"
        aItems={completedCards * 2}
        bItems={failCount}
        cItems={unreviewedCards * 2}
        title={title}
      />
    );
  }

  return (
    <section className="review-screen" aria-hidden={!props.active}>
      {renderTitle(props)}
      <div className="buttons">
        {props.phase !== ReviewPhase.Loading ? settingsButton : ''}
        <Link href="/" className="close-button" direction="backwards">
          Close
        </Link>
      </div>
      {content}
      {progressBar}
    </section>
  );
};
