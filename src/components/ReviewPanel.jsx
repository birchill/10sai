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
          <span className="button">✕</span>
        </button>
        <button
          className="pass"
          aria-label="Correct"
          onClick={props.onPassCard}>
          <span className="button">〇</span>
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
      <div>
        Extra content just to test scroll behavior.
      </div>
      <div>
        Extra content just to test scroll behavior.
      </div>
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
