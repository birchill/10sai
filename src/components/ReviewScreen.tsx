import * as React from 'react';
import DocumentTitle from 'react-document-title';

import { ReviewPhase } from '../review/review-phase';

import { Link } from './Link';
import { LoadingIndicator } from './LoadingIndicator';
import { ReviewPanelContainer } from './ReviewPanelContainer';
import { ReviewPanelInterface } from './ReviewPanel';
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
    failedCards: number;
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

const ReviewButton = React.forwardRef<HTMLButtonElement, ReviewProps>(
  (props: ReviewProps, ref: React.RefObject<HTMLButtonElement>) => {
    const numCards = nextReviewNumCards(props);
    return (
      <button
        className="button start -primary -center"
        onClick={evt => {
          props.onNewReview(props.maxNewCards, props.maxCards);
          // Stop propagation or else if this was triggered by pressing 'Enter'
          // the new ReviewPanel might catch the 'Enter' and reveal the back of
          // the card immediately.
          evt.stopPropagation();
        }}
        ref={ref}
      >
        {`New review (${numCards})`}
      </button>
    );
  }
);

const pluralCards = (num: number) => (num === 1 ? 'card' : 'cards');

export class ReviewScreen extends React.PureComponent<Props> {
  reviewPanelRef: React.RefObject<ReviewPanelInterface>;
  reviewButtonRef: React.RefObject<HTMLButtonElement>;
  containerRef: React.RefObject<HTMLDivElement>;

  constructor(props: Props) {
    super(props);

    this.reviewPanelRef = React.createRef<ReviewPanelInterface>();
    this.reviewButtonRef = React.createRef<HTMLButtonElement>();
    this.containerRef = React.createRef<HTMLDivElement>();
  }

  componentDidMount() {
    if (this.props.active) {
      this.activate();
    }
  }

  componentDidUpdate(previousProps: Props) {
    if (!this.props.active) {
      return;
    }
    if (
      !previousProps.active ||
      this.props.phase !== previousProps.phase ||
      this.isLoading() !== this.isLoading(previousProps)
    ) {
      this.activate();
    }
  }

  activate() {
    if (this.reviewPanelRef.current) {
      this.reviewPanelRef.current.focus();
    } else if (this.reviewButtonRef.current) {
      this.reviewButtonRef.current.focus();
    } else if (this.containerRef.current) {
      this.containerRef.current.focus();
    }
  }

  render() {
    const settingsButton = (
      <Link href="/review/settings" className="settings-button">
        Settings
      </Link>
    );

    return (
      <section className="review-screen" aria-hidden={!this.props.active}>
        {this.renderTitle()}
        <div className="buttons">
          {!this.isLoading() ? settingsButton : ''}
          <Link href="/" className="close-button" direction="backwards">
            Close
          </Link>
        </div>
        {this.renderContent()}
        {this.renderProgressBar()}
      </section>
    );
  }

  isLoading(props?: Props): boolean {
    const propsToUse = props || this.props;
    // We are loading if we are in the loading phase OR we are idle / complete
    // but don't yet know how many cards are available
    return (
      propsToUse.phase === ReviewPhase.Loading ||
      ([ReviewPhase.Idle, ReviewPhase.Complete].includes(propsToUse.phase) &&
        !propsToUse.availableCards)
    );
  }

  renderTitle(): React.ReactNode | null {
    if (!this.props.active) {
      return null;
    }

    let subtitle = 'Review';

    if (this.isLoading()) {
      subtitle = 'Loading...';
    }

    switch (this.props.phase) {
      case ReviewPhase.Complete:
        subtitle = 'Review complete';
        break;

      case ReviewPhase.Reviewing:
        {
          const {
            failedCards,
            completedCards,
            unreviewedCards,
          } = this.props.reviewProgress;

          const total = completedCards + unreviewedCards + failedCards;
          const complete = completedCards + failedCards * 0.5;
          const percentComplete = Math.round((complete / total) * 100);
          subtitle = `Review (${percentComplete}%)`;
        }
        break;
    }

    return <DocumentTitle title={`10sai - ${subtitle}`} />;
  }

  renderContent(): React.ReactNode {
    if (this.isLoading()) {
      return (
        <div className="content summary-panel">
          <div className="icon">
            <LoadingIndicator />
          </div>
        </div>
      );
    }

    if (this.props.phase === ReviewPhase.Idle) {
      const numCards = nextReviewNumCards(this.props);
      if (numCards === 0) {
        return (
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
      }

      return (
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
            <ReviewButton {...this.props} ref={this.reviewButtonRef} />
          </div>
        </div>
      );
    }

    if (this.props.phase === ReviewPhase.Complete) {
      // TODO: Stats here about review -- num cards reviewed, % correct on first
      // attempt.

      let nextReviewPrompt: React.ReactNode | null = null;

      const numCards = nextReviewNumCards(this.props);
      if (numCards !== 0) {
        const { newCards, overdueCards } = this.props.availableCards;
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
            <ReviewButton {...this.props} ref={this.reviewButtonRef} />
          </React.Fragment>
        );
      }

      return (
        <div
          className="content summary-panel"
          tabIndex={0}
          ref={this.containerRef}
        >
          <div className="icon -general -reviewfinished" />
          <h4 className="heading">All done!</h4>
          <div className="details">{nextReviewPrompt}</div>
        </div>
      );
    }

    // Something is messed up with react-redux's typings for ref attributes
    //
    // See: https://github.com/DefinitelyTyped/DefinitelyTyped/issues/35661
    const refAttribute: any = { ref: this.reviewPanelRef };
    return (
      <ReviewPanelContainer
        active={this.props.active}
        className="content"
        {...refAttribute}
      />
    );
  }

  renderProgressBar(): React.ReactNode | null {
    if (this.props.phase !== ReviewPhase.Reviewing) {
      return null;
    }

    // We want to roughly represent the number of reviews.
    //
    // If we pass a card immediately, we treat that as passing two reviews since
    // effectively we skipped the two reviews we would do if we failed it.
    // Similarly, for unseen cards.
    const {
      failedCards,
      completedCards,
      unreviewedCards,
    } = this.props.reviewProgress;
    const remaining = failedCards + unreviewedCards;
    const title =
      remaining === 1 ? '1 review remaining' : `${remaining} reviews remaining`;
    return (
      <TricolorProgress
        className="progress"
        aItems={completedCards}
        bItems={failedCards}
        cItems={unreviewedCards}
        title={title}
      />
    );
  }
}
