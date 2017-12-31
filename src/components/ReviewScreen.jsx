import React from 'react';
import PropTypes from 'prop-types';

import ReviewState from '../review-states';

import Link from './Link.jsx';
import LoadingIndicator from './LoadingIndicator.jsx';
import ReviewPanel from './ReviewPanel.jsx';

const nextReviewNumCards = props => {
  return Math.min(
    Math.min(props.availableCards.newCards, props.maxNewCards) +
      props.availableCards.overdueCards,
    props.maxCards
  );
};

const renderReviewButton = props => {
  const numCards = nextReviewNumCards(props);
  return (
    <button
      className="start -primary -center"
      onClick={() => {
        props.onNewReview(props.maxNewCards, props.maxCards);
      }}>
      {`New review (${numCards})`}
    </button>
  );
};

renderReviewButton.propTypes = {
  onNewReview: PropTypes.func.isRequired,
  maxNewCards: PropTypes.number.isRequired,
  maxCards: PropTypes.number.isRequired,
};

function ReviewScreen(props) {
  const settingsButton = (
    <Link href="/review/settings" className="settings-button">
      Settings
    </Link>
  );

  const pluralCards = num => (num === 1 ? 'card' : 'cards');

  let content;
  if (props.reviewState === ReviewState.LOADING) {
    content = (
      <div className="content summary-panel">
        <div className="icon">
          <LoadingIndicator />
        </div>
      </div>
    );
  } else if (props.reviewState === ReviewState.IDLE) {
    const numCards = nextReviewNumCards(props);
    if (numCards === 0) {
      content = (
        <div className="content summary-panel">
          <div className="icon -nocards" />
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
          <div className="icon -review" />
          <h4 className="heading">Start a new review</h4>
          <div className="details">
            <p>
              The next review will include{' '}
              <strong>{`${numCards} ${pluralCards(numCards)}`}</strong>.
            </p>
            <p>
              You can adjust the number of cards to review from the
              <span className="icon -settings">&nbsp;</span>
              settings above.
            </p>
            {renderReviewButton(props)}
          </div>
        </div>
      );
    }
  } else if (props.reviewState === ReviewState.COMPLETE) {
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
            There are still{' '}
            <strong>{`${newCards} new ${pluralCards(newCards)}`}</strong> and{' '}
            <strong>
              {`${overdueCards} overdue ${pluralCards(overdueCards)}`}
            </strong>{' '}
            cards available to review.
          </p>
        );
      } else if (newCards > 0) {
        promptText = (
          <p>
            There are still{' '}
            <strong>{`${newCards} new ${pluralCards(newCards)}`}</strong>{' '}
            available to review.
          </p>
        );
      } else {
        promptText = (
          <p>
            There are still{' '}
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
          {renderReviewButton(props)}
        </React.Fragment>
      );
    }

    content = (
      <div className="content summary-panel">
        <div className="icon -finished" />
        <h4 className="heading">All done!</h4>
        <div className="details">{nextReviewPrompt}</div>
      </div>
    );
  } else {
    content = (
      <ReviewPanel
        className="content"
        showAnswer={props.reviewState === ReviewState.ANSWER}
      />
    );
  }

  return (
    <section className="review-screen" aria-hidden={!props.active}>
      <div className="buttons">
        {props.reviewState !== ReviewState.LOADING ? settingsButton : ''}
        <Link href="/" className="close-button" direction="backwards">
          Close
        </Link>
      </div>
      {content}
    </section>
  );
}

ReviewScreen.propTypes = {
  active: PropTypes.bool.isRequired,
  reviewState: PropTypes.symbol.isRequired,
  // eslint-disable-next-line react/no-unused-prop-types
  onNewReview: PropTypes.func.isRequired,
  availableCards: PropTypes.shape({
    newCards: PropTypes.number.isRequired,
    overdueCards: PropTypes.number.isRequired,
  }),
  // Can't wait to switch to TypeScript and check this properly
  // eslint-disable-next-line react/no-unused-prop-types
  maxNewCards: PropTypes.number,
  // eslint-disable-next-line react/no-unused-prop-types
  maxCards: PropTypes.number,
};

export default ReviewScreen;
