import React from 'react';
import PropTypes from 'prop-types';

import ReviewCard from './ReviewCard.jsx';

function ReviewPanel(props) {
  let previousCard;
  if (props.previousCard) {
    previousCard = (
      <ReviewCard
        key={props.previousCard._id}
        className="previous"
        showAnswer
        {...props.previousCard}
      />
    );
  }

  const currentCard = (
    <ReviewCard
      key={props.currentCard._id}
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
        key={props.nextCard._id}
        className="next"
        {...props.nextCard}
      />
    );
  }

  let answerButtons;
  if (props.showAnswer) {
    answerButtons = (
      <div className="answer-buttons">
        <button
          className="fail"
          aria-label="Incorrect"
          onClick={props.onFailCard}>
          <span className="buttonface">
            <svg width="2em" height="2em" viewBox="0 0 100 100">
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
          className="pass"
          aria-label="Correct"
          onClick={props.onPassCard}>
          <span className="buttonface">
            <svg width="2em" height="2em" viewBox="0 0 100 100">
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
  }

  return (
    <div className={`review-panel ${props.className || ''}`}>
      <div className="cards">
        <div className="cardwrapper">
          {previousCard}
          {currentCard}
          {nextCard}
        </div>
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
  }),
  currentCard: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    question: PropTypes.string.isRequired,
    answer: PropTypes.string,
  }).isRequired,
  nextCard: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    question: PropTypes.string.isRequired,
    answer: PropTypes.string,
  }),
};

export default ReviewPanel;
