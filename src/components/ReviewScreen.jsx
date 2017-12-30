import React from 'react';
import PropTypes from 'prop-types';

import ReviewState from '../review-states';

import Link from './Link.jsx';
import LoadingIndicator from './LoadingIndicator.jsx';
import ReviewPanel from './ReviewPanel.jsx';

function ReviewScreen(props) {
  const settingsButton = (
    <Link href="/review/settings" className="settings-button">
      Settings
    </Link>
  );

  let content;
  if (props.reviewState === ReviewState.LOADING) {
    content = (
      <div className="summary-panel">
        <div className="icon">
          <LoadingIndicator />
        </div>
      </div>
    );
  } else if (
    props.reviewState === ReviewState.IDLE ||
    props.reviewState === ReviewState.COMPLETE
  ) {
    let newReviewButton;
    if (props.availabilityLoading) {
      newReviewButton = (
        <button className="start -primary -center" disabled>
          <LoadingIndicator />
        </button>
      );
    } else {
      const availableCards =
        `There are ${props.availableCards.newCards} new` +
        ` cards and ${props.availableCards.overdueCards} overdue cards` +
        ' available.';
      const cardsToReview = Math.min(
        Math.min(props.availableCards.newCards, props.maxNewCards) +
          props.availableCards.overdueCards,
        props.maxCards
      );
      newReviewButton = (
        <React.Fragment>
          <p>{availableCards}</p>
          <button className="start -primary -center">
            {`New review (${cardsToReview})`}
          </button>
        </React.Fragment>
      );
    }

    const heading =
      props.reviewState === ReviewState.COMPLETED
        ? 'Review finished!'
        : 'Start a new review';
    // TODO: Display stats for finished review (e.g. number of cards review,
    // % correct on first attempt.)

    content = (
      <div className="summary-panel">
        <div className="icon -review" />
        <h4 className="heading">{heading}</h4>
        <div className="details">{newReviewButton}</div>
      </div>
    );
  } else {
    content = (
      <ReviewPanel showAnswer={props.reviewState === ReviewState.ANSWER} />
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
  availabilityLoading: PropTypes.bool.isRequired,
  availableCards: PropTypes.shape({
    newCards: PropTypes.number.isRequired,
    overdueCards: PropTypes.number.isRequired,
  }),
  maxNewCards: PropTypes.number,
  maxCards: PropTypes.number,
};

export default ReviewScreen;
