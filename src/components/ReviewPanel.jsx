import React from 'react';
import PropTypes from 'prop-types';

import DynamicNoteList from './DynamicNoteList';
import ReviewCard from './ReviewCard.jsx';

function ReviewPanel(props) {
  // There is one case where both the previous card and the next card might be
  // the same card (if the current card and previous card are the same we remove
  // the current card from the history). In that case we still need unique keys
  // for the two instances of the card or else React will complain and fail to
  // update the DOM correctly.
  //
  // Ideally, we still want to transition both so we want to maintain the
  // deduplicated keys for subsequent renders but that's quite messy. Instead,
  // We just take care to assign the undeduped ID to the *next* card so that at
  // least the card appears to transition from the right.
  const keysInUse = new Set();
  keysInUse.getUnique = function getUniqueKey(key) {
    let keyToTry = key;
    let index = 1;
    while (this.has(keyToTry)) {
      keyToTry = `${key}-${++index}`;
    }
    this.add(keyToTry);
    return keyToTry;
  };

  const currentCard = (
    <ReviewCard
      key={keysInUse.getUnique(props.currentCard._id)}
      className="current"
      onSelectCard={props.onSelectCard}
      showAnswer={props.showAnswer}
      {...props.currentCard}
    />
  );

  let nextCard;
  if (props.nextCard) {
    nextCard = (
      <ReviewCard
        key={keysInUse.getUnique(props.nextCard._id)}
        className="next"
        {...props.nextCard}
      />
    );
  }

  let previousCard;
  if (props.previousCard) {
    previousCard = (
      <ReviewCard
        key={keysInUse.getUnique(props.previousCard._id)}
        className="previous"
        showAnswer
        {...props.previousCard}
      />
    );
  }

  const answerButtons = (
    <div className="answer-buttons" hidden={!props.showAnswer}>
      <button
        className="fail"
        aria-label="Incorrect"
        onClick={props.onFailCard}
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
      <button className="pass" aria-label="Correct" onClick={props.onPassCard}>
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
    <div className={`review-panel ${props.className || ''}`}>
      <div className="cards">
        <div className="cardwrapper">
          {previousCard}
          {currentCard}
          {nextCard}
        </div>
        {props.showAnswer ? (
          <>
            <hr className="note-divider divider" />
            <DynamicNoteList
              context={{
                screen: 'review',
              }}
              notes={props.notes}
              keywords={props.currentCard.keywords}
              priority="reading"
            />
          </>
        ) : null}
      </div>
      {answerButtons}
    </div>
  );
}

ReviewPanel.propTypes = {
  className: PropTypes.string,
  showAnswer: PropTypes.bool,
  onSelectCard: PropTypes.func.isRequired,
  onPassCard: PropTypes.func.isRequired,
  onFailCard: PropTypes.func.isRequired,
  previousCard: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    question: PropTypes.string.isRequired,
    answer: PropTypes.string,
    keywords: PropTypes.arrayOf(PropTypes.string).isRequired,
  }),
  currentCard: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    question: PropTypes.string.isRequired,
    answer: PropTypes.string,
    keywords: PropTypes.arrayOf(PropTypes.string).isRequired,
  }).isRequired,
  nextCard: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    question: PropTypes.string.isRequired,
    answer: PropTypes.string,
    keywords: PropTypes.arrayOf(PropTypes.string).isRequired,
  }),
  notes: PropTypes.arrayOf(
    PropTypes.shape({
      formId: PropTypes.number,
      note: PropTypes.object.isRequired,
      dirtyFields: PropTypes.instanceOf(Set),
      saveState: PropTypes.string.isRequired,
      saveError: PropTypes.object,
    })
  ).isRequired,
};

export default ReviewPanel;
